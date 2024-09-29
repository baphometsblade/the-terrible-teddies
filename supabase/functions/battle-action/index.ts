import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    )

    const { battleId, action, playerId } = await req.json()

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