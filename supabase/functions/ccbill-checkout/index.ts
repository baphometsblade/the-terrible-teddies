import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.104.1";
// The same decisions the Stripe checkout uses: origin, bundle lookup, the
// one-per-account refusal, and the open-checkout hold. See checkoutGuards.js.
import {
  resolveOrigin, lookupBundle, isOnePerAccount, onePerAccountRefusal,
  checkoutExpiry, holdDecision, HOLD_ACTION, claimOutcome,
} from "../create-checkout-session/checkoutGuards.js";
import { flexFormPaymentLink } from "./flexforms.js";

// The account's open one-per-account checkout (checkout_holds) is read and
// written with the service role. No client role may touch that table.
const serviceClient = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
);

const NOT_CHARGED_RETRY = "Couldn't start checkout. You haven't been charged — please try again.";

// Authoritative prices in USD cents. Must match create-checkout-session,
// stripe-webhook and ccbill-webhook. gemBundles.test.js fails if they drift.
const GEM_BUNDLES: Record<string, { gems: number; bonus: number; price: number; name: string }> = {
  gems_small:        { gems: 50,   bonus: 0,   price: 99,   name: "50 Gems" },
  gems_medium:       { gems: 150,  bonus: 10,  price: 299,  name: "150 Gems + 10 Bonus" },
  gems_large:        { gems: 500,  bonus: 50,  price: 999,  name: "500 Gems + 50 Bonus" },
  gems_huge:         { gems: 1200, bonus: 200, price: 1999, name: "1,200 Gems + 200 Bonus" },
  gems_mega:         { gems: 3000, bonus: 750, price: 4999, name: "3,000 Gems + 750 Bonus" },
  starter_bundle:    { gems: 300,  bonus: 0,   price: 499,  name: "Starter Gem Pack — 300 Gems" },
  weekly_gem_pass:   { gems: 350,  bonus: 0,   price: 599,  name: "Mega Gem Pack — 350 Gems" },
};

const ALLOWED_ORIGINS = [
  Deno.env.get("ALLOWED_ORIGIN"),
  ...(Deno.env.get("DENO_ENV") !== "production" ? [
    "http://localhost:3000",
    "http://localhost:5173",
    "http://localhost:8080",
  ] : []),
].filter(Boolean) as string[];

const getCorsHeaders = (requestOrigin: string | null) => {
  const origin = resolveOrigin(requestOrigin, ALLOWED_ORIGINS);
  return {
    "Access-Control-Allow-Origin": origin ?? "",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  };
};

const json = (body: unknown, status: number, corsHeaders: Record<string, string>) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

serve(async (req) => {
  const requestOrigin = req.headers.get("Origin");
  const corsHeaders = getCorsHeaders(requestOrigin);

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return json({ error: "Missing or invalid authorization" }, 401, corsHeaders);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return json({ error: "Invalid or expired session" }, 401, corsHeaders);
    }

    // The window and the account both come from the database. The JWT on this
    // client is the buyer's, so check_rate_limit reads auth.uid().
    const { data: allowed, error: rateLimitError } = await supabase.rpc("check_rate_limit", {
      p_action_type: "checkout",
    });
    if (rateLimitError || allowed === false) {
      return json({ error: "Too many requests. Please wait a minute." }, 429, corsHeaders);
    }

    const { bundle_id } = await req.json();
    const bundle = lookupBundle(GEM_BUNDLES, bundle_id);
    if (!bundle) {
      return json({ error: "Invalid bundle ID" }, 400, corsHeaders);
    }

    let replacesHold: string | null = null;

    if (isOnePerAccount(bundle_id)) {
      const { data: prior, error: priorError } = await supabase
        .from("purchases")
        .select("status")
        .eq("user_id", user.id)
        .eq("bundle_id", bundle_id);
      if (priorError) {
        console.error("Purchase history read failed:", priorError);
        return json(
          { error: "Couldn't check your purchase history. You haven't been charged — please try again." },
          503,
          corsHeaders,
        );
      }
      const refusal = onePerAccountRefusal(bundle_id, prior);
      if (refusal) {
        return json({ error: refusal.error, code: refusal.code }, refusal.status, corsHeaders);
      }

      const { data: holdRows, error: holdError } = await serviceClient.rpc("get_checkout_hold", {
        p_user_id: user.id,
        p_bundle_id: bundle_id,
      });
      if (holdError) {
        console.error("Open-checkout read failed:", holdError);
        return json({ error: NOT_CHARGED_RETRY }, 503, corsHeaders);
      }
      const hold = Array.isArray(holdRows) ? holdRows[0] ?? null : null;
      // get_checkout_hold only returns a row that has not expired. CCBill has
      // no session to retrieve, so a live hold is the open payment link.
      const held = hold
        ? { id: hold.stripe_session_id, status: "open", url: hold.checkout_url }
        : null;
      const decision = holdDecision(hold, held);
      if (decision.action === HOLD_ACTION.REUSE) {
        return json({ url: decision.url, session_id: decision.sessionId, reused: true }, 200, corsHeaders);
      }
      if (decision.action === HOLD_ACTION.REFUSE) {
        return json({ error: decision.error, code: decision.code }, decision.status, corsHeaders);
      }
      replacesHold = decision.replaces ?? null;
    }

    const safeOrigin = resolveOrigin(requestOrigin, ALLOWED_ORIGINS);
    if (!safeOrigin) {
      return json({ error: "Invalid origin" }, 400, corsHeaders);
    }

    const link = flexFormPaymentLink({
      flexFormId: Deno.env.get("CCBILL_FLEXFORM_ID") ?? "",
      accountNumber: Deno.env.get("CCBILL_ACCOUNT_NUMBER") ?? "",
      subaccount: Deno.env.get("CCBILL_SUBACCOUNT") ?? "",
      priceCents: bundle.price,
      userId: user.id,
      bundleId: bundle_id,
      salt: Deno.env.get("CCBILL_SALT") ?? "",
    });
    if (!link) {
      console.error("CCBill checkout is not configured");
      return json({ error: NOT_CHARGED_RETRY }, 503, corsHeaders);
    }

    const sessionId = `ccbill_${crypto.randomUUID()}`;
    const expiresAt = checkoutExpiry(bundle_id, Date.now() / 1000);

    if (isOnePerAccount(bundle_id)) {
      const { data: claimRows, error: claimError } = await serviceClient.rpc("claim_checkout_hold", {
        p_user_id: user.id,
        p_bundle_id: bundle_id,
        p_session_id: sessionId,
        p_checkout_url: link.url,
        p_expires_at: new Date((expiresAt ?? 0) * 1000).toISOString(),
        p_replaces: replacesHold,
      });
      const created = { id: sessionId, url: link.url };
      const outcome = claimError ? null : claimOutcome(claimRows, created);
      // A lost race never hands out its own link. There is no CCBill session
      // to expire; the URL was not sent anywhere.
      if (!outcome) {
        console.error("Open-checkout claim failed:", claimError ?? claimRows, sessionId);
        return json({ error: NOT_CHARGED_RETRY }, 503, corsHeaders);
      }
      return json({
        url: outcome.url,
        session_id: outcome.sessionId,
        ...(outcome.expireCreated ? { reused: true } : {}),
      }, 200, corsHeaders);
    }

    return json({ url: link.url, session_id: sessionId }, 200, corsHeaders);
  } catch (error) {
    console.error("CCBill checkout error:", error);
    return json({ error: "Unable to create checkout session. Please try again." }, 500, corsHeaders);
  }
});
