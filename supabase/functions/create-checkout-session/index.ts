import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.104.1";
// Origin allowlisting and bundle lookup are pure decisions, so they live in a
// module the test suite can import. See checkoutGuards.js.
import {
  resolveOrigin, lookupBundle, redirectUrls, isOnePerAccount, onePerAccountRefusal,
  checkoutExpiry, holdDecision, HOLD_ACTION, isMissingStripeSession, claimOutcome,
} from "./checkoutGuards.js";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") ?? "", {
  apiVersion: "2023-10-16",
  httpClient: Stripe.createFetchHttpClient(),
});

// The account's open one-per-account checkout (checkout_holds) is read and
// written with the service role. No client role may touch that table, so a
// buyer cannot clear their own hold to open a second starter checkout.
const serviceClient = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
);

// Nothing is charged by saying no, so every check below that cannot be
// completed refuses rather than sells.
const NOT_CHARGED_RETRY = "Couldn't start checkout. You haven't been charged — please try again.";

// Expire a session this request created but will not hand out. Its URL was
// never sent anywhere, so nobody can be paying in it; if expiring fails it
// simply lapses at its own expires_at.
const expireUnsent = async (sessionId: string) => {
  try {
    await stripe.checkout.sessions.expire(sessionId);
  } catch (err) {
    console.error("Could not expire an unsent checkout session:", sessionId, err);
  }
};

const GEM_BUNDLES: Record<string, { gems: number; bonus: number; price: number; name: string }> = {
  gems_small:        { gems: 50,   bonus: 0,   price: 99,   name: "50 Gems" },
  gems_medium:       { gems: 150,  bonus: 10,  price: 299,  name: "150 Gems + 10 Bonus" },
  gems_large:        { gems: 500,  bonus: 50,  price: 999,  name: "500 Gems + 50 Bonus" },
  gems_huge:         { gems: 1200, bonus: 200, price: 1999, name: "1,200 Gems + 200 Bonus" },
  gems_mega:         { gems: 3000, bonus: 750, price: 4999, name: "3,000 Gems + 750 Bonus" },
  starter_bundle:    { gems: 300,  bonus: 0,   price: 499,  name: "Starter Gem Pack — 300 Gems" },
  weekly_gem_pass:   { gems: 350,  bonus: 0,   price: 599,  name: "Mega Gem Pack — 350 Gems" },
};

// Rate limiting config - enforced via database for durability across function restarts
const RATE_LIMIT_MAX = 5;
const RATE_LIMIT_WINDOW_SECONDS = 60;

// Allowed origins — production domain set via env var, localhost only in dev
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

serve(async (req) => {
  const requestOrigin = req.headers.get("Origin");
  const corsHeaders = getCorsHeaders(requestOrigin);

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Verify JWT and extract user from token (not from request body)
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Missing or invalid authorization" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Invalid or expired session" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Rate limit via database (durable across function restarts)
    const { data: allowed, error: rateLimitError } = await supabase.rpc("check_rate_limit", {
      p_user_id: user.id,
      p_action_type: "checkout",
      p_max_requests: RATE_LIMIT_MAX,
      p_window_seconds: RATE_LIMIT_WINDOW_SECONDS,
    });
    if (rateLimitError || allowed === false) {
      return new Response(
        JSON.stringify({ error: "Too many requests. Please wait a minute." }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { bundle_id } = await req.json();

    // Own-property lookup: a bare index would hand back Object.prototype members
    // for ids like "constructor", which are truthy and slip past this check.
    const bundle = lookupBundle(GEM_BUNDLES, bundle_id);
    if (!bundle) {
      return new Response(
        JSON.stringify({ error: "Invalid bundle ID" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // The finished checkout (expired, or unknown to Stripe) that a new one for
    // a one-per-account bundle may take the place of.
    let replacesHold: string | null = null;

    // One per account (the Starter Gem Pack). Read with the buyer's own JWT:
    // purchases_select_own lets an account see exactly its own rows, which is
    // all this needs. A failed read refuses rather than sells, because the
    // check cannot be skipped and nothing is charged by saying no.
    if (isOnePerAccount(bundle_id)) {
      const { data: prior, error: priorError } = await supabase
        .from("purchases")
        .select("status")
        .eq("user_id", user.id)
        .eq("bundle_id", bundle_id);
      if (priorError) {
        console.error("Purchase history read failed:", priorError);
        return new Response(
          JSON.stringify({ error: "Couldn't check your purchase history. You haven't been charged — please try again." }),
          { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const refusal = onePerAccountRefusal(bundle_id, prior);
      if (refusal) {
        return new Response(
          JSON.stringify({ error: refusal.error, code: refusal.code }),
          { status: refusal.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Purchases only show a payment once it is fulfilled, so a buyer with a
      // starter checkout already open (another tab, or Back to the Shop) used
      // to get a second one and could pay both. Hand back the open one.
      const { data: holdRows, error: holdError } = await serviceClient.rpc("get_checkout_hold", {
        p_user_id: user.id,
        p_bundle_id: bundle_id,
      });
      if (holdError) {
        console.error("Open-checkout read failed:", holdError);
        return new Response(
          JSON.stringify({ error: NOT_CHARGED_RETRY }),
          { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const hold = Array.isArray(holdRows) ? holdRows[0] ?? null : null;
      let heldSession: Stripe.Checkout.Session | null = null;
      if (hold) {
        try {
          heldSession = await stripe.checkout.sessions.retrieve(hold.stripe_session_id);
        } catch (err) {
          if (!isMissingStripeSession(err)) {
            console.error("Open-checkout lookup at Stripe failed:", hold.stripe_session_id, err);
            return new Response(
              JSON.stringify({ error: NOT_CHARGED_RETRY }),
              { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }
        }
      }
      const decision = holdDecision(hold, heldSession);
      if (decision.action === HOLD_ACTION.REUSE) {
        return new Response(
          JSON.stringify({ url: decision.url, session_id: decision.sessionId, reused: true }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (decision.action === HOLD_ACTION.REFUSE) {
        return new Response(
          JSON.stringify({ error: decision.error, code: decision.code }),
          { status: decision.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      replacesHold = decision.replaces ?? null;
    }

    // Validate origin is in allowlist — prevent open redirect
    const safeOrigin = resolveOrigin(requestOrigin, ALLOWED_ORIGINS);
    if (!safeOrigin) {
      return new Response(
        JSON.stringify({ error: "Invalid origin" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const totalGems = bundle.gems + bundle.bonus;
    // Half an hour for a one-per-account bundle, so an abandoned checkout
    // stops standing in for a new one quickly; Stripe's default otherwise.
    const expiresAt = checkoutExpiry(bundle_id, Date.now() / 1000);

    const session = await stripe.checkout.sessions.create({
      ...(expiresAt ? { expires_at: expiresAt } : {}),
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: `Terrible Teddies — ${bundle.name}`,
              description: `${totalGems} gems for use in Terrible Teddies`,
            },
            unit_amount: bundle.price,
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      ...redirectUrls(safeOrigin),
      client_reference_id: user.id,
      metadata: {
        bundle_id,
        user_id: user.id,
        gems: String(bundle.gems),
        bonus: String(bundle.bonus),
        total_gems: String(totalGems),
      },
    });

    if (isOnePerAccount(bundle_id)) {
      // Record it as the account's open checkout. A request racing this one
      // may have recorded its own first; then that one is the buyer's, and
      // the session just created is expired unsent.
      const { data: claimRows, error: claimError } = await serviceClient.rpc("claim_checkout_hold", {
        p_user_id: user.id,
        p_bundle_id: bundle_id,
        p_session_id: session.id,
        p_checkout_url: session.url,
        p_expires_at: new Date(session.expires_at * 1000).toISOString(),
        p_replaces: replacesHold,
      });
      const outcome = claimError ? null : claimOutcome(claimRows, session);
      if (!outcome || outcome.expireCreated) await expireUnsent(session.id);
      if (!outcome) {
        console.error("Open-checkout claim failed:", claimError ?? claimRows, session.id);
        return new Response(
          JSON.stringify({ error: NOT_CHARGED_RETRY }),
          { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      return new Response(
        JSON.stringify({ url: outcome.url, session_id: outcome.sessionId, ...(outcome.expireCreated ? { reused: true } : {}) }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ url: session.url, session_id: session.id }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Checkout session error:", error);
    return new Response(
      JSON.stringify({ error: "Unable to create checkout session. Please try again." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
