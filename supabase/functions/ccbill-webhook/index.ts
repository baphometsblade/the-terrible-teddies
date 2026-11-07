import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.104.1";
import {
  ACTION, authenticateWebhook, routeEvent, saleCredit,
  fulfillmentSuccessResponse, fulfillmentErrorResponse, reversalResponse,
  parseWebhookIps, clientIpFromHeaders, mergeWebhookPayload, parseWebhookBody,
  eventCreatedSeconds,
} from "./webhook.js";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
);

// Authoritative prices in USD cents. Must match the other three tables.
// The credit uses this, never the price echoed in a custom field.
const GEM_BUNDLES: Record<string, { gems: number; bonus: number; price: number }> = {
  gems_small:      { gems: 50,   bonus: 0,   price: 99 },
  gems_medium:     { gems: 150,  bonus: 10,  price: 299 },
  gems_large:      { gems: 500,  bonus: 50,  price: 999 },
  gems_huge:       { gems: 1200, bonus: 200, price: 1999 },
  gems_mega:       { gems: 3000, bonus: 750, price: 4999 },
  starter_bundle:  { gems: 300,  bonus: 0,   price: 499 },
  weekly_gem_pass: { gems: 350,  bonus: 0,   price: 599 },
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const salt = Deno.env.get("CCBILL_SALT") ?? "";
  if (!salt) {
    console.error("CCBILL_SALT is not set");
    return new Response("Webhook not configured", { status: 500 });
  }

  let text: string;
  try {
    text = await req.text();
  } catch (err) {
    console.error("Unreadable webhook body:", err);
    return new Response("Unreadable body", { status: 400 });
  }

  let body: Record<string, unknown>;
  try {
    body = parseWebhookBody(text, req.headers.get("content-type"));
  } catch (err) {
    console.error("Webhook body rejected:", err);
    return new Response("Invalid body", { status: 400 });
  }

  const query = Object.fromEntries(new URL(req.url).searchParams.entries());
  const merged = mergeWebhookPayload(query, body);
  if (merged.error || !merged.payload) {
    return new Response("Event type mismatch", { status: 400 });
  }
  const payload = merged.payload;

  const auth = authenticateWebhook(payload, {
    salt,
    allowlist: parseWebhookIps(Deno.env.get("CCBILL_WEBHOOK_IPS")),
    ip: clientIpFromHeaders(req.headers),
  });
  if (!auth.ok) {
    console.error("Webhook rejected:", auth.error);
    return new Response(auth.error ?? "Forbidden", { status: auth.status });
  }

  const route = routeEvent(payload);

  if (route.action === ACTION.FULFILL) {
    const credit = saleCredit(payload, GEM_BUNDLES);
    if (!credit.ok || !credit.rpc) {
      console.error("Refusing to credit:", credit.error);
      return new Response(credit.error ?? "Refused", { status: credit.status ?? 500 });
    }
    try {
      const { data: outcome, error: rpcError } = await supabase.rpc("fulfill_gem_purchase", credit.rpc);
      if (rpcError) {
        const decision = fulfillmentErrorResponse(rpcError);
        console.error("Fulfillment failed:", decision.outcome, credit.rpc.p_session_id, rpcError);
        const message = decision.outcome === "one_per_account_refund_required"
          ? "Duplicate one-per-account sale was not credited; refund it in CCBill"
          : "Fulfillment failed";
        return new Response(message, { status: decision.status });
      }
      const done = fulfillmentSuccessResponse(outcome);
      return json(done.body, done.status);
    } catch (err) {
      console.error("Fulfillment error:", err);
      return new Response("Fulfillment failed", { status: 500 });
    }
  }

  if (route.action === ACTION.REVERSE) {
    try {
      const { data: outcome, error: rpcError } = await supabase.rpc("reverse_gem_purchase", {
        p_payment_intent: route.paymentIntent,
        p_reason: route.reversalReason,
      });
      if (rpcError) {
        console.error("Reversal failed:", rpcError, route.paymentIntent);
        return new Response("Reversal failed", { status: 500 });
      }
      const now = Math.floor(Date.now() / 1000);
      const created = eventCreatedSeconds(payload) ?? now;
      const done = reversalResponse(outcome, created, now);
      return json(done.body, done.status);
    } catch (err) {
      console.error("Reversal error:", err);
      return new Response("Reversal failed", { status: 500 });
    }
  }

  return json({ received: true, ignored: route.ignored ?? "unhandled" });
});
