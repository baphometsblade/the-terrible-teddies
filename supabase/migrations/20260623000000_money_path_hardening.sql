-- Money-path hardening from the security audit.
--
-- The paid-currency INFLOW (Stripe -> add_user_gems) is already authentic and
-- idempotent. This migration tightens the server-side sync RPCs that the
-- client can call directly, and narrows leaderboard exposure.

-- ============================================================================
-- sync_battle_result: clamp the client-supplied coin grant.
--
-- Battles are resolved client-side, so p_coins_earned is fully attacker-
-- controlled. Auth already restricts callers to their own row; this also caps
-- the per-call credit so a user can't mint unbounded coins by looping the RPC
-- with a huge value. A legitimate win pays 25 + streak*5, so 1000 leaves ample
-- headroom while blocking gross abuse.
-- ============================================================================
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
  v_coins INTEGER;
  v_damage INTEGER;
  v_healing INTEGER;
BEGIN
  IF auth.uid() IS NULL OR auth.uid() != p_user_id THEN
    RAISE EXCEPTION 'Unauthorized: cannot modify another user''s stats';
  END IF;

  -- Clamp client-supplied magnitudes to sane per-battle maxima.
  v_coins   := LEAST(GREATEST(COALESCE(p_coins_earned, 0), 0), 1000);
  v_damage  := LEAST(GREATEST(COALESCE(p_damage_dealt, 0), 0), 10000);
  v_healing := LEAST(GREATEST(COALESCE(p_healing_done, 0), 0), 10000);

  SELECT current_win_streak, best_win_streak
  INTO v_current_streak, v_best_streak
  FROM public.players WHERE user_id = p_user_id;

  IF p_won THEN
    v_current_streak := COALESCE(v_current_streak, 0) + 1;
    v_best_streak := GREATEST(COALESCE(v_best_streak, 0), v_current_streak);
  ELSE
    v_current_streak := 0;
  END IF;

  UPDATE public.players SET
    total_wins = total_wins + (CASE WHEN p_won THEN 1 ELSE 0 END),
    total_losses = total_losses + (CASE WHEN p_won THEN 0 ELSE 1 END),
    total_battles = total_battles + 1,
    wins = COALESCE(wins, 0) + (CASE WHEN p_won THEN 1 ELSE 0 END),
    losses = COALESCE(losses, 0) + (CASE WHEN p_won THEN 0 ELSE 1 END),
    current_win_streak = v_current_streak,
    best_win_streak = v_best_streak,
    total_damage_dealt = total_damage_dealt + v_damage,
    total_healing_done = total_healing_done + v_healing,
    coins = coins + v_coins
  WHERE user_id = p_user_id;
END;
$$;

-- ============================================================================
-- sync_player_level: cap the per-call level increase.
--
-- The client passes its absolute level/xp; previously a single call could jump
-- straight to level 100, topping the leaderboard without playing. Allow at most
-- +2 levels per sync (a battle grants well under one level's worth of XP) and
-- keep the absolute caps.
-- ============================================================================
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
  IF auth.uid() IS NULL OR auth.uid() != p_user_id THEN
    RAISE EXCEPTION 'Unauthorized: cannot modify another user''s level';
  END IF;

  UPDATE public.players SET
    level = LEAST(GREATEST(level, LEAST(p_level, level + 2)), 100),
    xp = LEAST(GREATEST(COALESCE(p_xp, 0), 0), 10000),
    experience = LEAST(GREATEST(COALESCE(p_xp, 0), 0), 10000)
  WHERE user_id = p_user_id
    AND p_level >= level;
END;
$$;

-- ============================================================================
-- Leaderboard exposure: serve rankings through a view that exposes only the
-- columns the board needs (no coins balance, no user_id), and restrict direct
-- reads of `players` to the owner's own row. The view runs with definer rights
-- so it can still rank across all players.
-- ============================================================================
CREATE OR REPLACE VIEW public.leaderboard
WITH (security_invoker = false) AS
SELECT
  username,
  COALESCE(wins, 0)            AS wins,
  COALESCE(losses, 0)          AS losses,
  COALESCE(experience, 0)      AS experience,
  COALESCE(best_win_streak, 0) AS best_win_streak
FROM public.players
ORDER BY wins DESC NULLS LAST, experience DESC NULLS LAST
LIMIT 100;

GRANT SELECT ON public.leaderboard TO authenticated, anon;

-- Tighten the players SELECT policy to own-row only; the leaderboard view now
-- provides the cross-player read surface.
DROP POLICY IF EXISTS "players_select_authenticated" ON public.players;
DROP POLICY IF EXISTS "Allow authenticated read access" ON public.players;
DROP POLICY IF EXISTS "players_select_own" ON public.players;
CREATE POLICY "players_select_own"
  ON public.players FOR SELECT
  USING (auth.uid() = user_id);
