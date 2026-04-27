import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
  const origin = ALLOWED_ORIGINS.includes(requestOrigin ?? "") ? requestOrigin : ALLOWED_ORIGINS[0];
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

    const bundle = GEM_BUNDLES[bundle_id];
    if (!bundle) {
      return new Response(
        JSON.stringify({ error: "Invalid bundle ID" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate origin is in allowlist — prevent open redirect
    const safeOrigin = ALLOWED_ORIGINS.includes(requestOrigin ?? "") ? requestOrigin : ALLOWED_ORIGINS[0];
    if (!safeOrigin) {
      return new Response(
        JSON.stringify({ error: "Invalid origin" }),
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
      success_url: `${safeOrigin}/?purchase=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${safeOrigin}/?purchase=cancelled`,
      client_reference_id: user.id,
      metadata: {
        bundle_id,
        user_id: user.id,
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
