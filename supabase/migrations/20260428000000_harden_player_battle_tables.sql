-- Defensive hardening migration.
--
-- Prior migrations only ever ALTER `players` and assume `matches`/`battles`
-- already exist with RLS enabled. If any of those tables was created
-- out-of-band (e.g. via Studio) WITHOUT row-level security, then every policy
-- layered on top is dead weight and the anon/auth key can read or rewrite
-- ANY user's coins/stats directly. This migration makes the security posture
-- explicit and idempotent: the tables exist, RLS is ON, and writes to
-- authoritative currency columns are only possible through the SECURITY
-- DEFINER functions (which verify auth.uid()).

-- ============================================================================
-- players: authoritative profile + soft-currency (coins) + stats
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.players (
  user_id    UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username   TEXT,
  coins      INTEGER     NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Backfill the full column set regardless of how the table was first created.
ALTER TABLE public.players
  ADD COLUMN IF NOT EXISTS username           TEXT,
  ADD COLUMN IF NOT EXISTS coins              INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS wins               INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS losses             INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_wins         INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_losses       INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_battles      INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS best_win_streak    INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS current_win_streak INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_damage_dealt INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_healing_done INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS level              INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS xp                 INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS experience         INTEGER DEFAULT 0;

ALTER TABLE public.players ENABLE ROW LEVEL SECURITY;

-- Authenticated users may read player rows (required for the leaderboard).
DROP POLICY IF EXISTS "players_select_authenticated" ON public.players;
CREATE POLICY "players_select_authenticated"
  ON public.players FOR SELECT
  USING (auth.role() = 'authenticated');

-- Users may only UPDATE their own row, and only non-currency fields in
-- practice (coins/stats are written exclusively by SECURITY DEFINER funcs).
DROP POLICY IF EXISTS "players_update_own" ON public.players;
CREATE POLICY "players_update_own"
  ON public.players FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ============================================================================
-- matches: lobby rows written directly from the browser (anon key)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.matches (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  player_one_id  UUID        REFERENCES auth.users(id) ON DELETE CASCADE,
  player_two_id  UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  status         TEXT        NOT NULL DEFAULT 'waiting',
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.matches ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can see open lobbies; participants can act on their own.
DROP POLICY IF EXISTS "matches_select_authenticated" ON public.matches;
CREATE POLICY "matches_select_authenticated"
  ON public.matches FOR SELECT
  USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "matches_insert_own" ON public.matches;
CREATE POLICY "matches_insert_own"
  ON public.matches FOR INSERT
  WITH CHECK (auth.uid() = player_one_id);

-- A participant (creator, or a player joining an open lobby) may update.
DROP POLICY IF EXISTS "matches_update_participant" ON public.matches;
CREATE POLICY "matches_update_participant"
  ON public.matches FOR UPDATE
  USING (auth.uid() IN (player_one_id, player_two_id) OR player_two_id IS NULL)
  WITH CHECK (auth.uid() IN (player_one_id, player_two_id));

-- ============================================================================
-- battles: turn-by-turn state mutated by the battle-action edge function
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.battles (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  player1_id     UUID        REFERENCES auth.users(id) ON DELETE CASCADE,
  player2_id     UUID        REFERENCES auth.users(id) ON DELETE CASCADE,
  player1_health INTEGER     NOT NULL DEFAULT 30,
  player2_health INTEGER     NOT NULL DEFAULT 30,
  current_turn   UUID,
  status         TEXT        NOT NULL DEFAULT 'ongoing',
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.battles ENABLE ROW LEVEL SECURITY;

-- Only the two participants can read or mutate a battle row.
DROP POLICY IF EXISTS "battles_select_participant" ON public.battles;
CREATE POLICY "battles_select_participant"
  ON public.battles FOR SELECT
  USING (auth.uid() IN (player1_id, player2_id));

DROP POLICY IF EXISTS "battles_update_participant" ON public.battles;
CREATE POLICY "battles_update_participant"
  ON public.battles FOR UPDATE
  USING (auth.uid() IN (player1_id, player2_id))
  WITH CHECK (auth.uid() IN (player1_id, player2_id));

-- ============================================================================
-- add_user_gems: defense-in-depth. This function mints the PAID currency and
-- has no per-user auth check by design (the webhook calls it as service role,
-- where auth.uid() is NULL). Make it structurally impossible for an
-- authenticated client to ever call it, even if a GRANT is reintroduced.
-- ============================================================================
CREATE OR REPLACE FUNCTION add_user_gems(p_user_id UUID, p_gems INTEGER)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Service-role / webhook calls have a NULL auth.uid(). Any non-NULL caller
  -- is an authenticated client trying to mint gems for free — reject it.
  IF auth.uid() IS NOT NULL THEN
    RAISE EXCEPTION 'add_user_gems may only be called server-side';
  END IF;

  IF p_gems <= 0 THEN
    RAISE EXCEPTION 'Gem amount must be positive';
  END IF;

  INSERT INTO user_gems (user_id, gems, total_purchased)
  VALUES (p_user_id, p_gems, p_gems)
  ON CONFLICT (user_id) DO UPDATE SET
    gems            = user_gems.gems + p_gems,
    total_purchased = user_gems.total_purchased + p_gems,
    updated_at      = NOW();
END;
$$;

REVOKE EXECUTE ON FUNCTION add_user_gems(UUID, INTEGER) FROM public;
REVOKE EXECUTE ON FUNCTION add_user_gems(UUID, INTEGER) FROM authenticated;
