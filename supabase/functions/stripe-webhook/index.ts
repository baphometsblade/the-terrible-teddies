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
    const meta = session.metadata ?? {};
    const bundleId = meta.bundle_id ?? "unknown";
    const userId = meta.user_id || null;
    const totalGems = parseInt(meta.total_gems ?? "0", 10);

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

      if (insertError && insertError.code !== "23505") {
        // 23505 = unique violation (already processed) — safe to ignore
        console.error("Failed to insert purchase:", insertError);
      }

      // Credit gems to authenticated user
      if (userId) {
        const { error: rpcError } = await supabase.rpc("add_user_gems", {
          p_user_id: userId,
          p_gems: totalGems,
        });
        if (rpcError) console.error("Failed to credit gems:", rpcError);
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
