import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
  weekly_gem_pass: { gems: 350,  bonus: 0,   price: 199 },
};

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
    console.error("Webhook signature verification failed:", err);
    return new Response(`Webhook error: ${(err as Error).message}`, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;

    // Verify payment was actually successful (handles delayed payment methods)
    if (session.payment_status !== "paid") {
      console.log("Checkout completed but payment not yet received:", session.id);
      return new Response(JSON.stringify({ received: true, pending: true }), {
        headers: { "Content-Type": "application/json" },
      });
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
    if (!bundle) {
      console.error("Refusing to fulfill unknown bundle:", bundleId, session.id);
      // Acknowledge so Stripe stops retrying; nothing is credited.
      return new Response(JSON.stringify({ received: true, ignored: "unknown_bundle" }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    // Verify the amount actually charged matches the bundle's expected price.
    if ((session.amount_total ?? 0) !== bundle.price) {
      console.error(
        "Amount mismatch — refusing to credit:", session.id,
        "charged:", session.amount_total, "expected:", bundle.price
      );
      return new Response(JSON.stringify({ received: true, ignored: "amount_mismatch" }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    const totalGems = bundle.gems + bundle.bonus;

    try {
      // Record purchase — idempotent via UNIQUE constraint on stripe_session_id
      const { error: insertError } = await supabase.from("purchases").insert({
        user_id: userId,
        bundle_id: bundleId,
        gems_granted: totalGems,
        stripe_session_id: session.id,
        amount_paid: session.amount_total ?? 0,
        status: "completed",
      });

      if (insertError) {
        if (insertError.code === "23505") {
          // Duplicate — already processed, safe to return success
          return new Response(JSON.stringify({ received: true, duplicate: true }), {
            headers: { "Content-Type": "application/json" },
          });
        }
        // Non-duplicate insert failure — return 500 to trigger Stripe retry
        console.error("Failed to insert purchase:", insertError);
        return new Response("Database insert failed", { status: 500 });
      }

      // Credit gems to the (validated) user, only after a successful insert.
      const { error: rpcError } = await supabase.rpc("add_user_gems", {
        p_user_id: userId,
        p_gems: totalGems,
      });
      if (rpcError) {
        console.error("Failed to credit gems:", rpcError);
        return new Response("Gem credit failed", { status: 500 });
      }
    } catch (err) {
      console.error("Fulfillment error:", err);
      return new Response("Fulfillment failed", { status: 500 });
    }
  }

  return new Response(JSON.stringify({ received: true }), {
    headers: { "Content-Type": "application/json" },
  });
});
