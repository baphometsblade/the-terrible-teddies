import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Restrict origins - production domain via env, localhost only in dev
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

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Verify JWT and extract user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Missing or invalid authorization" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Invalid or expired session" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { battleId, action } = await req.json();
    // Use authenticated user ID, not client-provided playerId
    const playerId = user.id;

    const { data: battle, error: battleError } = await supabase
      .from('battles')
      .select('*')
      .eq('id', battleId)
      .single()

    if (battleError) throw battleError

    if (battle.current_turn !== playerId) {
      throw new Error("It's not your turn")
    }

    let damage = 0
    if (action === 'attack') {
      damage = Math.floor(Math.random() * 5) + 1 // Simple random damage
    }

    const isPlayer1 = playerId === battle.player1_id
    const updatedHealth = isPlayer1
      ? battle.player2_health - damage
      : battle.player1_health - damage

    const { data: updatedBattle, error: updateError } = await supabase
      .from('battles')
      .update({
        [isPlayer1 ? 'player2_health' : 'player1_health']: updatedHealth,
        current_turn: isPlayer1 ? battle.player2_id : battle.player1_id,
        status: updatedHealth <= 0 ? 'finished' : 'ongoing'
      })
      .eq('id', battleId)
      .select()
      .single()

    if (updateError) throw updateError

    return new Response(JSON.stringify(updatedBattle), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})