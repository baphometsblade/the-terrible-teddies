-- Add comprehensive player stats columns for server-side sync
ALTER TABLE public.players
ADD COLUMN IF NOT EXISTS total_wins INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_losses INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_battles INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS best_win_streak INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS current_win_streak INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_damage_dealt INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_healing_done INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS level INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS xp INTEGER DEFAULT 0;

-- Function to create or update player profile on login
CREATE OR REPLACE FUNCTION upsert_player_profile(
  p_user_id UUID,
  p_username TEXT DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.players (user_id, username)
  VALUES (p_user_id, COALESCE(p_username, 'Player_' || LEFT(p_user_id::text, 8)))
  ON CONFLICT (user_id) DO NOTHING;
END;
$$;

-- Function to record battle result (server-side truth)
CREATE OR REPLACE FUNCTION sync_battle_result(
  p_user_id UUID,
  p_won BOOLEAN,
  p_damage_dealt INTEGER DEFAULT 0,
  p_healing_done INTEGER DEFAULT 0,
  p_coins_earned INTEGER DEFAULT 0
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_current_streak INTEGER;
  v_best_streak INTEGER;
BEGIN
  -- Get current streak info
  SELECT current_win_streak, best_win_streak
  INTO v_current_streak, v_best_streak
  FROM public.players WHERE user_id = p_user_id;

  -- Calculate new streaks
  IF p_won THEN
    v_current_streak := COALESCE(v_current_streak, 0) + 1;
    v_best_streak := GREATEST(COALESCE(v_best_streak, 0), v_current_streak);
  ELSE
    v_current_streak := 0;
  END IF;

  -- Update player stats
  UPDATE public.players SET
    total_wins = total_wins + (CASE WHEN p_won THEN 1 ELSE 0 END),
    total_losses = total_losses + (CASE WHEN p_won THEN 0 ELSE 1 END),
    total_battles = total_battles + 1,
    current_win_streak = v_current_streak,
    best_win_streak = v_best_streak,
    total_damage_dealt = total_damage_dealt + COALESCE(p_damage_dealt, 0),
    total_healing_done = total_healing_done + COALESCE(p_healing_done, 0),
    coins = coins + GREATEST(p_coins_earned, 0)
  WHERE user_id = p_user_id;
END;
$$;

-- Function to sync XP/level from client (validated range)
CREATE OR REPLACE FUNCTION sync_player_level(
  p_user_id UUID,
  p_level INTEGER,
  p_xp INTEGER
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Basic validation - level can only increase, XP must be reasonable
  UPDATE public.players SET
    level = GREATEST(level, LEAST(p_level, 100)),  -- Cap at level 100
    xp = LEAST(p_xp, 10000)  -- Cap XP at reasonable amount
  WHERE user_id = p_user_id
    AND p_level >= level;  -- Can only increase level
END;
$$;

-- Allow authenticated users to call these functions
GRANT EXECUTE ON FUNCTION upsert_player_profile(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION sync_battle_result(UUID, BOOLEAN, INTEGER, INTEGER, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION sync_player_level(UUID, INTEGER, INTEGER) TO authenticated;
