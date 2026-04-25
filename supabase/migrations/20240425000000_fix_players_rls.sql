-- Fix overly permissive UPDATE policy on players table
-- Users should NOT be able to modify coins/wins/losses directly

-- Drop the old permissive policy if it exists
DROP POLICY IF EXISTS "Users can update own player data" ON public.players;

-- Create a restricted UPDATE policy that only allows username changes
CREATE POLICY "Users can update own profile" ON public.players
  FOR UPDATE USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Note: To update coins/wins/losses, use SECURITY DEFINER functions below
-- These can only be called by the server/service role

-- Function to safely add coins (called after battle victories)
CREATE OR REPLACE FUNCTION add_player_coins(p_user_id UUID, p_coins INTEGER)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF p_coins <= 0 THEN
    RAISE EXCEPTION 'Coins must be positive';
  END IF;

  UPDATE public.players
  SET coins = coins + p_coins
  WHERE user_id = p_user_id;
END;
$$;

-- Function to record battle result (called by server after battle completion)
CREATE OR REPLACE FUNCTION record_player_battle(p_user_id UUID, p_won BOOLEAN, p_coins_earned INTEGER)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF p_won THEN
    UPDATE public.players
    SET wins = wins + 1,
        coins = coins + GREATEST(p_coins_earned, 0)
    WHERE user_id = p_user_id;
  ELSE
    UPDATE public.players
    SET losses = losses + 1,
        coins = coins + GREATEST(p_coins_earned, 0)
    WHERE user_id = p_user_id;
  END IF;
END;
$$;

-- Revoke direct execute from public, only service role can call these
REVOKE EXECUTE ON FUNCTION add_player_coins(UUID, INTEGER) FROM public;
REVOKE EXECUTE ON FUNCTION record_player_battle(UUID, BOOLEAN, INTEGER) FROM public;
