-- Leaderboard-integrity hardening from the follow-up audit.
--
-- Three client-facing leaderboard vectors survived the earlier money-path
-- hardening because that pass focused on paid currency, not ranking:
--
--   1. sync_player_level throttles the `level` column (+2/call) but set
--      `experience` to the raw client value (up to 10000) in ONE call. The
--      leaderboard view exposes `experience`, and the client derives level and
--      trophies from it (floor(experience/100)+1), so a fresh account could
--      RPC experience=10000 straight from the console and show as level 101 /
--      ~1010 trophies with zero battles. Cap the per-call experience INCREASE
--      to mirror the level throttle.
--
--   2. sync_battle_result increments wins/total_wins by +1 per call with no
--      rate limit, so a for-loop in the console forged unlimited leaderboard
--      wins instantly. Gate it behind the existing check_rate_limit (the
--      server-owned limiter already used for checkout). This stops the instant
--      loop; a fully cheat-proof board needs server-authoritative battle
--      resolution, which is a larger change tracked separately.
--
--   3. The username-privacy fix (set_player_username + client passing NULL)
--      stopped NEW email-derived names but never scrubbed the ones already
--      written from email.split('@')[0] — those email local parts stayed
--      published on the public leaderboard. Backfill them to a non-identifying
--      handle.

-- ============================================================================
-- 1) sync_player_level: cap the per-call experience increase.
--
-- Keeps the +2/call level throttle and the absolute caps. `experience` now
-- rises by at most +200 per call (~two levels on the flat 100/level leaderboard
-- scale), never decreases, and is capped at 10000. A legitimate battle grants
-- far less than that, so real play is unaffected; console fraud is throttled to
-- the same slow climb the level column already enforces.
-- ============================================================================
CREATE OR REPLACE FUNCTION sync_player_level(
  p_user_id UUID,
  p_level INTEGER,
  p_xp INTEGER
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF auth.uid() IS NULL OR auth.uid() != p_user_id THEN
    RAISE EXCEPTION 'Unauthorized: cannot modify another user''s level';
  END IF;

  UPDATE public.players SET
    level = LEAST(GREATEST(level, LEAST(p_level, level + 2)), 100),
    xp = LEAST(GREATEST(COALESCE(p_xp, 0), 0), 10000),
    -- Bounded increase: never more than +200 over the current stored value,
    -- never below it, capped at 10000. This is the fraud fix — setting
    -- experience straight to the client value defeated the level throttle.
    experience = LEAST(
      GREATEST(COALESCE(experience, 0), LEAST(COALESCE(p_xp, 0), COALESCE(experience, 0) + 200)),
      10000
    )
  WHERE user_id = p_user_id
    AND p_level >= level;
END;
$$;

-- ============================================================================
-- 2) sync_battle_result: rate-limit the win/stat writes.
--
-- Same body as before, plus a check_rate_limit gate keyed on 'battle_result'.
-- check_rate_limit derives the window/limit server-side (the client can't relax
-- it) and returns FALSE once the window is exhausted; we simply skip the write
-- then. The client calls this fire-and-forget, so a throttled sync is a silent
-- no-op rather than an error. The default action limit (5 / 60s) is generous for
-- real play — a battle takes minutes — while turning the instant forge-loop into
-- a trickle.
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
SET search_path = pg_catalog, public
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

  -- Throttle: once the per-window budget is spent, drop the write. Battles are
  -- client-resolved, so this is the only brake on looping forged wins.
  IF NOT public.check_rate_limit(p_user_id, 'battle_result') THEN
    RETURN;
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
-- 3) One-time backfill: scrub email-derived usernames from the leaderboard.
--
-- Before the client stopped passing email.split('@')[0] (commit bba1f55), every
-- pre-existing player row stored the caller's email local part, and
-- upsert_player_profile uses ON CONFLICT DO NOTHING so those rows are never
-- overwritten. The forward fix left that PII published on the public leaderboard
-- view. Replace every existing name with a stable, non-identifying handle
-- derived from the (opaque) user_id; players can re-personalize via
-- set_player_username. Runs once. New signups pass NULL, so nothing re-introduces
-- an email name after this.
-- ============================================================================
UPDATE public.players
SET username = 'Teddy ' || upper(substr(md5(user_id::text), 1, 4))
WHERE username IS NOT NULL;
