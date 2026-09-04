import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.104.1";

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

// A PaymentIntent reference on Stripe objects can be an id string or an
// expanded object; normalize to the id we stored on the purchase row.
const paymentIntentId = (pi: string | { id: string } | null | undefined): string | null =>
  typeof pi === "string" ? pi : pi?.id ?? null;

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

  // ── Fulfillment: credit gems on a paid checkout ──────────────────────────
  if (event.type === "checkout.session.completed") {
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
  if (
    event.type === "charge.dispute.funds_reinstated" ||
    event.type === "charge.dispute.closed"
  ) {
    const dispute = event.data.object as Stripe.Dispute;
    if (event.type === "charge.dispute.closed" && dispute.status !== "won") {
      console.log("Dispute closed as", dispute.status, "— leaving the reversal in place:", dispute.id);
      return json({ received: true, ignored: "dispute_not_won" });
    }
    const paymentIntent = paymentIntentId(dispute.payment_intent);
    if (!paymentIntent) {
      console.error("Restoration event without a payment_intent:", event.id);
      return json({ received: true, ignored: "no_payment_intent" });
    }
    try {
      const { data: outcome, error: rpcError } = await supabase.rpc("restore_gem_purchase", {
        p_payment_intent: paymentIntent,
      });
      if (rpcError) {
        console.error("Restoration failed:", rpcError, paymentIntent);
        return new Response("Restoration failed", { status: 500 });
      }
      return json({ received: true, outcome });
    } catch (err) {
      console.error("Restoration error:", err);
      return new Response("Restoration failed", { status: 500 });
    }
  }

  // ── Reversal: claw gems back on refund or dispute ────────────────────────
  if (event.type === "charge.refunded" || event.type === "charge.dispute.created") {
    // A refund may be partial; only claw back the gems on a FULL refund — a
    // partial refund leaves the purchase intact and is logged for manual
    // handling.
    let paymentIntent: string | null;
    let reason: "refunded" | "disputed";

    if (event.type === "charge.refunded") {
      const charge = event.data.object as Stripe.Charge;
      // Compare against the captured amount (what can actually be refunded), so
      // a full refund of a partially-captured charge still counts as full.
      if (charge.amount_refunded < charge.amount_captured) {
        console.log("Partial refund — leaving gems in place:", charge.id);
        return json({ received: true, ignored: "partial_refund" });
      }
      paymentIntent = paymentIntentId(charge.payment_intent);
      reason = "refunded";
    } else {
      const dispute = event.data.object as Stripe.Dispute;
      // NOT every dispute takes the money. This branch used to assert that it
      // did — "a dispute (chargeback) always reverses the funds" — and debit
      // unconditionally. An inquiry or retrieval request is created with a
      // warning_* status (warning_needs_response, warning_under_review,
      // warning_closed): the issuer is asking for information and Stripe
      // withdraws nothing. Debiting there takes the player's gems while the
      // merchant keeps the payment, which is the wrong side of the error to be
      // on. The refund branch above already declines to act when the money has
      // not actually moved; this is the same rule for disputes.
      if (dispute.status.startsWith("warning_")) {
        console.log("Dispute inquiry", dispute.status, "— no funds withdrawn, leaving gems in place:", dispute.id);
        return json({ received: true, ignored: "dispute_inquiry" });
      }
      paymentIntent = paymentIntentId(dispute.payment_intent);
      reason = "disputed";
    }

    if (!paymentIntent) {
      console.error("Reversal event without a payment_intent:", event.id);
      return json({ received: true, ignored: "no_payment_intent" });
    }

    try {
      const { data: outcome, error: rpcError } = await supabase.rpc("reverse_gem_purchase", {
        p_payment_intent: paymentIntent,
        p_reason: reason,
      });
      if (rpcError) {
        console.error("Reversal failed:", rpcError, paymentIntent);
        return new Response("Reversal failed", { status: 500 });
      }
      if (outcome === "not_found") {
        // No matching purchase — an unrelated refund, or a reconciliation gap.
        // Ack (Stripe shouldn't retry) but surface it for manual review.
        console.warn("Reversal for unknown payment_intent:", paymentIntent);
      }
      return json({ received: true, outcome });
    } catch (err) {
      console.error("Reversal error:", err);
      return new Response("Reversal failed", { status: 500 });
    }
  }

  return json({ received: true });
});
