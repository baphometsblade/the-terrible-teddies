import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0?target=deno";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") ?? "", {
  apiVersion: "2023-10-16",
  httpClient: Stripe.createFetchHttpClient(),
});

const GEM_BUNDLES: Record<string, { gems: number; bonus: number; price: number; name: string }> = {
  gems_small:        { gems: 50,   bonus: 0,   price: 99,   name: "50 Gems" },
  gems_medium:       { gems: 150,  bonus: 10,  price: 299,  name: "150 Gems + 10 Bonus" },
  gems_large:        { gems: 500,  bonus: 50,  price: 999,  name: "500 Gems + 50 Bonus" },
  gems_huge:         { gems: 1200, bonus: 200, price: 1999, name: "1,200 Gems + 200 Bonus" },
  gems_mega:         { gems: 3000, bonus: 750, price: 4999, name: "3,000 Gems + 750 Bonus" },
  starter_bundle:    { gems: 100,  bonus: 0,   price: 499,  name: "Starter Bundle" },
  weekly_gem_pass:   { gems: 350,  bonus: 0,   price: 199,  name: "Weekly Gem Pass" },
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { bundle_id, user_id, origin } = await req.json();

    const bundle = GEM_BUNDLES[bundle_id];
    if (!bundle) {
      return new Response(
        JSON.stringify({ error: "Invalid bundle ID" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const totalGems = bundle.gems + bundle.bonus;

    const session = await stripe.checkout.sessions.create({
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
      success_url: `${origin}/?purchase=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/?purchase=cancelled`,
      client_reference_id: user_id ?? "anonymous",
      metadata: {
        bundle_id,
        user_id: user_id ?? "",
        gems: String(bundle.gems),
        bonus: String(bundle.bonus),
        total_gems: String(totalGems),
      },
    });

    return new Response(
      JSON.stringify({ url: session.url, session_id: session.id }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Checkout session error:", error);
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
