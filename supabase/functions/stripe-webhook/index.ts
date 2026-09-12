import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.104.1";
// The decision layer — which event means what — lives in a pure module so it
// can be unit tested. See eventRouting.js; every branch it owns has been wrong
// at least once.
import { ACTION, routeEvent, reversalNotFoundAction, paymentIntentId } from "./eventRouting.js";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") ?? "", {
  apiVersion: "2023-10-16",
  httpClient: Stripe.createFetchHttpClient(),
});

const supabase = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
);

// Authoritative bundle definitions — MUST match create-checkout-session.
// The webhook re-derives gem counts and the expected price from this table
// rather than trusting client-influenceable session metadata, and refuses to
// credit if the amount actually charged doesn't match.
const GEM_BUNDLES: Record<string, { gems: number; bonus: number; price: number }> = {
  gems_small:      { gems: 50,   bonus: 0,   price: 99 },
  gems_medium:     { gems: 150,  bonus: 10,  price: 299 },
  gems_large:      { gems: 500,  bonus: 50,  price: 999 },
  gems_huge:       { gems: 1200, bonus: 200, price: 1999 },
  gems_mega:       { gems: 3000, bonus: 750, price: 4999 },
  starter_bundle:  { gems: 300,  bonus: 0,   price: 499 },
  weekly_gem_pass: { gems: 350,  bonus: 0,   price: 599 },
};

const json = (obj: unknown, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: { "Content-Type": "application/json" } });

serve(async (req) => {
  const signature = req.headers.get("Stripe-Signature");
  if (!signature) {
    return new Response("Missing Stripe-Signature header", { status: 400 });
  }

  const body = await req.text();

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(
      body,
      signature,
      Deno.env.get("STRIPE_WEBHOOK_SECRET") ?? ""
    );
  } catch (err) {
    // Log the detail server-side; return a static message so a prober can't
    // read back the library's exact signature-mismatch text.
    console.error("Webhook signature verification failed:", err);
    return new Response("Invalid signature", { status: 400 });
  }

  // One decision, made in a pure function that is unit tested (eventRouting.js).
  // The handlers below carry out whatever it returns.
  const route = routeEvent(event as unknown as Record<string, unknown>);

  // ── Fulfillment: credit gems on a paid checkout ──────────────────────────
  if (route.action === ACTION.FULFILL) {
    const session = event.data.object as Stripe.Checkout.Session;

    // Verify payment was actually successful (handles delayed payment methods)
    if (session.payment_status !== "paid") {
      console.log("Checkout completed but payment not yet received:", session.id);
      return json({ received: true, pending: true });
    }

    const meta = session.metadata ?? {};
    const bundleId = meta.bundle_id ?? "unknown";
    const userId = meta.user_id || null;

    // Bind the credit to the paying customer. create-checkout-session sets both
    // metadata.user_id and client_reference_id to the JWT-verified user, so they
    // must agree and be a real UUID. If we can't confidently identify the user,
    // fail (500) so Stripe retries and the purchase isn't silently recorded as
    // completed-but-uncredited.
    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!userId || !UUID_RE.test(userId) || session.client_reference_id !== userId) {
      console.error(
        "Refusing to credit — user binding failed:", session.id,
        "user_id:", userId, "client_reference_id:", session.client_reference_id
      );
      return new Response("Invalid user binding", { status: 500 });
    }

    // Re-derive the gem count from the server-side bundle table; never trust
    // the client-influenceable total_gems metadata for the actual credit.
    const bundle = GEM_BUNDLES[bundleId];
    // The amount check compares USD cents; assert the unit too so a future
    // non-USD checkout path can't satisfy an integer meant for USD cents.
    // Unknown bundle / amount / currency should never happen for a session we
    // created — treat it as a config-drift bug: fail 500 so the paid order
    // stays visible in Stripe's dashboard instead of vanishing on a silent 200.
    if (!bundle) {
      console.error("Refusing to fulfill unknown bundle:", bundleId, session.id);
      return new Response("Unknown bundle", { status: 500 });
    }
    if ((session.currency ?? "usd") !== "usd") {
      console.error("Currency mismatch — refusing to credit:", session.id, "currency:", session.currency);
      return new Response("Currency mismatch", { status: 500 });
    }
    if ((session.amount_total ?? 0) !== bundle.price) {
      console.error(
        "Amount mismatch — refusing to credit:", session.id,
        "charged:", session.amount_total, "expected:", bundle.price
      );
      return new Response("Amount mismatch", { status: 500 });
    }

    const totalGems = bundle.gems + bundle.bonus;

    try {
      // Record the purchase and credit the gems atomically. Doing both in one
      // transaction (keyed on stripe_session_id) makes fulfillment exactly-once:
      // if the credit fails, the purchase row rolls back too, so Stripe's retry
      // re-runs cleanly instead of short-circuiting on a duplicate row that was
      // never actually credited. A genuine replay returns "duplicate" harmlessly.
      const { data: outcome, error: rpcError } = await supabase.rpc("fulfill_gem_purchase", {
        p_user_id: userId,
        p_bundle_id: bundleId,
        p_gems: totalGems,
        p_session_id: session.id,
        p_amount: session.amount_total ?? 0,
        p_payment_intent: paymentIntentId(session.payment_intent),
      });
      if (rpcError) {
        // Return 500 so Stripe retries; nothing was committed.
        console.error("Fulfillment failed:", rpcError, session.id);
        return new Response("Fulfillment failed", { status: 500 });
      }
      return json({ received: true, outcome });
    } catch (err) {
      console.error("Fulfillment error:", err);
      return new Response("Fulfillment failed", { status: 500 });
    }
  }

  // ── Restoration: a dispute that took nothing, or that we won ─────────────
  //
  // These arrive AFTER a reversal has already debited the player, and put the
  // gems back. Without them a paying customer was left permanently short:
  // reverse_gem_purchase is one-way, and replaying the fulfillment cannot
  // repair it either (fulfill_gem_purchase returns 'duplicate' on the existing
  // stripe_session_id before it reaches the credit).
  //
  //   charge.dispute.funds_reinstated — Stripe has returned the money.
  //   charge.dispute.closed           — only when we WON; a lost or accepted
  //                                     dispute must stay reversed.
  if (route.action === ACTION.RESTORE) {
    try {
      const { data: outcome, error: rpcError } = await supabase.rpc("restore_gem_purchase", {
        p_payment_intent: route.paymentIntent,
      });
      if (rpcError) {
        console.error("Restoration failed:", rpcError, route.paymentIntent);
        return new Response("Restoration failed", { status: 500 });
      }
      return json({ received: true, outcome });
    } catch (err) {
      console.error("Restoration error:", err);
      return new Response("Restoration failed", { status: 500 });
    }
  }

  // ── Reversal: claw gems back on refund or dispute ────────────────────────
  //
  // Which events reverse, and which are deliberately ignored (a partial refund,
  // or a warning_* dispute where Stripe withdrew nothing), is decided in
  // eventRouting.js and covered there by tests.
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
      if (outcome === "not_found") {
        // No purchase row for this payment_intent. Two very different causes:
        // a RACE (Stripe does not guarantee ordering, so the reversal can beat
        // the checkout.session.completed that creates the row — acking there
        // drops it and the later fulfillment credits money already given back),
        // or a genuinely unrelated charge, which is pointless to retry. The
        // event's own age separates them.
        if (reversalNotFoundAction(event.created, Math.floor(Date.now() / 1000)) === "retry") {
          console.warn(
            "Reversal arrived before its purchase — asking Stripe to retry:",
            route.paymentIntent,
          );
          return new Response("Purchase not yet fulfilled; retry", { status: 409 });
        }
        console.warn("Reversal for unknown payment_intent (stale, giving up):", route.paymentIntent);
      }
      return json({ received: true, outcome });
    } catch (err) {
      console.error("Reversal error:", err);
      return new Response("Reversal failed", { status: 500 });
    }
  }

  // Everything else, plus the deliberate skips: partial refunds, dispute
  // inquiries, a dispute closed any way but won, and event types this endpoint
  // does not subscribe to. route.ignored says which.
  if (route.ignored && route.ignored !== "unhandled") {
    // event.id rather than the charge/dispute id the per-branch logs used to
    // carry: collapsing those branches would otherwise have cost the one
    // identifier that makes a skipped event traceable during reconciliation,
    // and event.id is available for every type and is what the Stripe
    // dashboard indexes on.
    // no_payment_intent is an error, not a routine skip — a reversal or
    // restoration event that carries no payment_intent cannot be reconciled at
    // all — so it keeps the console.error severity its own branch used to have.
    const log = route.ignored === "no_payment_intent" ? console.error : console.log;
    log("Ignoring event:", event.type, event.id, "-", route.ignored);
    return json({ received: true, ignored: route.ignored });
  }

  return json({ received: true });
});
