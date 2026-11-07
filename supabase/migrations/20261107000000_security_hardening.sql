-- Security hardening for a project built from supabase/bootstrap.sql.
-- Idempotent. One transaction, as `supabase db push` applies each file.
--
-- 1. The public boards were SECURITY DEFINER views, so they ran as the owner
--    and bypassed row security on players. They are now security_invoker
--    views over SECURITY DEFINER functions that return only ranking columns
--    (no user_id, no coins, no level). Anonymous visitors can still read them.
-- 2. The RPCs a signed-in player can call no longer take p_user_id. The row
--    is auth.uid(). search_path is empty and every schema object is qualified.
--    Gem crediting and checkout holds stay service_role only.
-- 3. player_saves, checkout_holds and rate_limits had RLS and no policies.
--    A player may touch only their own save; the other two are service_role.
--    Table privileges on those three stay revoked from client roles, so the
--    save's compare-and-swap and the rate-limit window cannot be written
--    around the functions.
-- 4. sync_battle_result and sync_player_level still clamp a single call and
--    still spend check_rate_limit, now against auth.uid() rather than an id
--    the client supplied.

-- The old overloads stay callable if they are only replaced. Drop them.
-- Callers are dropped first: sync_* depends on check_rate_limit(uuid, text, ...).
DROP FUNCTION IF EXISTS public.sync_battle_result(UUID, BOOLEAN, INTEGER, INTEGER, INTEGER);
DROP FUNCTION IF EXISTS public.sync_player_level(UUID, INTEGER, INTEGER);
DROP FUNCTION IF EXISTS public.upsert_player_profile(UUID, TEXT);
DROP FUNCTION IF EXISTS public.check_rate_limit(UUID, TEXT, INTEGER, INTEGER);

-- ---------------------------------------------------------------------------
-- Rate limit. The window and the user both come from the server.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.check_rate_limit(p_action_type TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid          UUID := auth.uid();
  v_max          INTEGER;
  v_window       INTEGER;
  v_window_start TIMESTAMPTZ;
  v_count        INTEGER;
  v_cutoff       TIMESTAMPTZ;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not signed in' USING ERRCODE = 'PT401';
  END IF;

  -- Server-owned limits, keyed on the action. Anything else is rejected
  -- rather than defaulted, so the caller cannot mint new rate_limits rows.
  CASE p_action_type
    WHEN 'checkout'      THEN v_max := 5; v_window := 60;
    WHEN 'battle_result' THEN v_max := 5; v_window := 60;
    WHEN 'level_sync'    THEN v_max := 5; v_window := 60;
    ELSE RAISE EXCEPTION 'Unknown rate limit action: %', pg_catalog.left(COALESCE(p_action_type, '<null>'::text), 40);
  END CASE;

  v_cutoff := pg_catalog.now() - (v_window || ' seconds')::INTERVAL;

  SELECT window_start, request_count INTO v_window_start, v_count
  FROM public.rate_limits
  WHERE user_id = v_uid AND action_type = p_action_type
  FOR UPDATE;

  IF NOT FOUND THEN
    INSERT INTO public.rate_limits (user_id, action_type, window_start, request_count)
    VALUES (v_uid, p_action_type, pg_catalog.now(), 1)
    ON CONFLICT (user_id, action_type) DO UPDATE
      SET request_count = public.rate_limits.request_count + 1;
    RETURN TRUE;
  END IF;

  IF v_window_start < v_cutoff THEN
    UPDATE public.rate_limits
    SET window_start = pg_catalog.now(), request_count = 1
    WHERE user_id = v_uid AND action_type = p_action_type;
    RETURN TRUE;
  END IF;

  IF v_count >= v_max THEN
    RETURN FALSE;
  END IF;

  UPDATE public.rate_limits
  SET request_count = request_count + 1
  WHERE user_id = v_uid AND action_type = p_action_type;
  RETURN TRUE;
END;
$$;

-- ---------------------------------------------------------------------------
-- Profile, username, battle, level. The account is the session, never an argument.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.upsert_player_profile(p_username TEXT DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid  UUID := auth.uid();
  v_name TEXT := pg_catalog.btrim(COALESCE(p_username, ''::text));
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Unauthorized: must be signed in';
  END IF;

  -- Same rules set_player_username enforces; anything failing them falls back
  -- to the generated name instead of being stored verbatim.
  IF pg_catalog.char_length(v_name) < 2
     OR pg_catalog.char_length(v_name) > 20
     OR v_name !~ '^[A-Za-z0-9 _.!?-]+$' THEN
    v_name := 'Player_' || pg_catalog.left(v_uid::text, 8);
  END IF;

  INSERT INTO public.players (user_id, username)
  VALUES (v_uid, v_name)
  ON CONFLICT (user_id) DO NOTHING;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_player_username(p_username TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid  UUID := auth.uid();
  v_name TEXT := pg_catalog.btrim(COALESCE(p_username, ''::text));
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Unauthorized: must be signed in to set a username';
  END IF;

  -- 2–20 chars, letters/digits/space and a small punctuation set. Rejects
  -- control chars and angle brackets so a hostile name cannot carry markup
  -- into another player's leaderboard row.
  IF pg_catalog.length(v_name) < 2 OR pg_catalog.length(v_name) > 20 THEN
    RAISE EXCEPTION 'Username must be 2 to 20 characters';
  END IF;
  IF v_name !~ '^[A-Za-z0-9 _.!?-]+$' THEN
    RAISE EXCEPTION 'Username contains disallowed characters';
  END IF;

  INSERT INTO public.players (user_id, username)
  VALUES (v_uid, v_name)
  ON CONFLICT (user_id) DO UPDATE SET username = EXCLUDED.username;

  RETURN v_name;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_battle_result(
  p_won BOOLEAN,
  p_damage_dealt INTEGER DEFAULT 0,
  p_healing_done INTEGER DEFAULT 0,
  p_coins_earned INTEGER DEFAULT 0
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid            UUID := auth.uid();
  v_current_streak INTEGER;
  v_best_streak    INTEGER;
  v_coins          INTEGER;
  v_damage         INTEGER;
  v_healing        INTEGER;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Unauthorized: must be signed in';
  END IF;

  -- Throttle against this session, not an id from the request. Once the
  -- window is spent the write is dropped. Battles are client-resolved, so
  -- this is the brake on a loop of forged wins.
  IF NOT public.check_rate_limit('battle_result') THEN
    RETURN;
  END IF;

  -- Clamp client-supplied magnitudes to sane per-battle maxima.
  v_coins   := LEAST(GREATEST(COALESCE(p_coins_earned, 0), 0), 1000);
  v_damage  := LEAST(GREATEST(COALESCE(p_damage_dealt, 0), 0), 10000);
  v_healing := LEAST(GREATEST(COALESCE(p_healing_done, 0), 0), 10000);

  SELECT current_win_streak, best_win_streak
  INTO v_current_streak, v_best_streak
  FROM public.players WHERE user_id = v_uid;

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
  WHERE user_id = v_uid;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_player_level(
  p_level INTEGER,
  p_xp INTEGER
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid UUID := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Unauthorized: must be signed in';
  END IF;

  -- The +200/call bound alone only turns a one-call forge into a short loop.
  -- Five calls a minute is what a real battle produces; a console loop is not.
  IF NOT public.check_rate_limit('level_sync') THEN
    RETURN;
  END IF;

  UPDATE public.players SET
    level = LEAST(GREATEST(level, LEAST(p_level, level + 2)), 100),
    xp = LEAST(GREATEST(COALESCE(p_xp, 0), 0), 10000),
    -- Bounded increase: never more than +200 over the stored value, never
    -- below it, capped at 10000. Writing the client's number straight into
    -- experience is the forge this blocks.
    experience = LEAST(
      GREATEST(COALESCE(experience, 0), LEAST(COALESCE(p_xp, 0), COALESCE(experience, 0) + 200)),
      10000
    )
  WHERE user_id = v_uid
    AND p_level >= level;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_player_save()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_row public.player_saves%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not signed in' USING ERRCODE = 'PT401';
  END IF;

  SELECT * INTO v_row FROM public.player_saves WHERE user_id = v_uid;
  IF NOT FOUND THEN
    RETURN pg_catalog.jsonb_build_object('rev', 0, 'save', NULL, 'updated_at', NULL);
  END IF;
  RETURN pg_catalog.jsonb_build_object('rev', v_row.rev, 'save', v_row.save, 'updated_at', v_row.updated_at);
END;
$$;

CREATE OR REPLACE FUNCTION public.put_player_save(p_save JSONB, p_base_rev BIGINT)
RETURNS JSONB
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_rev BIGINT;
  v_at  TIMESTAMPTZ;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not signed in' USING ERRCODE = 'PT401';
  END IF;
  IF p_save IS NULL OR pg_catalog.jsonb_typeof(p_save) <> 'object' THEN
    RAISE EXCEPTION 'a save must be a JSON object' USING ERRCODE = '22023';
  END IF;
  IF p_base_rev IS NULL OR p_base_rev < 0 THEN
    RAISE EXCEPTION 'base rev must be 0 or more' USING ERRCODE = '22023';
  END IF;
  -- 64 KiB of the save's JSON text. PT413 reaches the client as HTTP 413.
  IF pg_catalog.octet_length(p_save::text) > 65536 THEN
    RAISE EXCEPTION 'save is larger than 64 KiB' USING ERRCODE = 'PT413';
  END IF;

  IF p_base_rev = 0 THEN
    INSERT INTO public.player_saves (user_id, save, rev)
    VALUES (v_uid, p_save, 1)
    ON CONFLICT (user_id) DO NOTHING
    RETURNING rev, updated_at INTO v_rev, v_at;
  ELSE
    UPDATE public.player_saves
       SET save = p_save, rev = rev + 1, updated_at = pg_catalog.now()
     WHERE user_id = v_uid AND rev = p_base_rev
    RETURNING rev, updated_at INTO v_rev, v_at;
  END IF;

  IF v_rev IS NOT NULL THEN
    RETURN pg_catalog.jsonb_build_object('ok', true, 'rev', v_rev, 'updated_at', v_at);
  END IF;

  SELECT rev, updated_at INTO v_rev, v_at FROM public.player_saves WHERE user_id = v_uid;
  RETURN pg_catalog.jsonb_build_object('ok', false, 'rev', COALESCE(v_rev, 0), 'updated_at', v_at);
END;
$$;

CREATE OR REPLACE FUNCTION public.get_my_rank()
RETURNS TABLE (
  rank BIGINT,
  trophies INTEGER,
  username TEXT,
  wins INTEGER,
  experience INTEGER,
  best_win_streak INTEGER
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  WITH me AS (
    SELECT
      p.username,
      COALESCE(p.wins, 0)            AS wins,
      COALESCE(p.experience, 0)      AS experience,
      COALESCE(p.best_win_streak, 0) AS best_win_streak,
      p.board_trophies               AS trophies
    FROM public.players p
    WHERE p.user_id = auth.uid()
  )
  SELECT
    1 + (
      SELECT count(*)
      FROM public.players o
      WHERE o.board_trophies > me.trophies
    ),
    me.trophies,
    me.username,
    me.wins,
    me.experience,
    me.best_win_streak
  FROM me
$$;

-- ---------------------------------------------------------------------------
-- Public boards. The functions run as the owner so they can rank every
-- player; the views run as the caller and add no columns of their own.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.leaderboard_rows()
RETURNS TABLE (
  username TEXT,
  wins INTEGER,
  losses INTEGER,
  experience INTEGER,
  best_win_streak INTEGER
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT
    p.username,
    COALESCE(p.wins, 0)::INTEGER,
    COALESCE(p.losses, 0)::INTEGER,
    COALESCE(p.experience, 0)::INTEGER,
    COALESCE(p.best_win_streak, 0)::INTEGER
  FROM public.players p
  ORDER BY p.wins DESC NULLS LAST, p.experience DESC NULLS LAST
  LIMIT 100
$$;

CREATE OR REPLACE FUNCTION public.leaderboard_trophies_rows()
RETURNS TABLE (
  username TEXT,
  wins INTEGER,
  losses INTEGER,
  experience INTEGER,
  best_win_streak INTEGER,
  trophies INTEGER,
  rank BIGINT,
  is_me BOOLEAN
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT
    t.username,
    t.wins,
    t.losses,
    t.experience,
    t.best_win_streak,
    t.trophies,
    pg_catalog.rank() OVER (ORDER BY t.trophies DESC) AS rank,
    t.is_me
  FROM (
    SELECT
      p.username,
      COALESCE(p.wins, 0)::INTEGER            AS wins,
      COALESCE(p.losses, 0)::INTEGER          AS losses,
      COALESCE(p.experience, 0)::INTEGER      AS experience,
      COALESCE(p.best_win_streak, 0)::INTEGER AS best_win_streak,
      p.board_trophies                        AS trophies,
      COALESCE(p.user_id = auth.uid(), false) AS is_me
    FROM public.players p
  ) t
  ORDER BY t.trophies DESC, t.wins DESC, t.experience DESC, t.username
  LIMIT 100
$$;

DROP VIEW IF EXISTS public.leaderboard_trophies;
DROP VIEW IF EXISTS public.leaderboard;

CREATE VIEW public.leaderboard
WITH (security_invoker = true) AS
SELECT username, wins, losses, experience, best_win_streak
FROM public.leaderboard_rows();

CREATE VIEW public.leaderboard_trophies
WITH (security_invoker = true) AS
SELECT username, wins, losses, experience, best_win_streak, trophies, rank, is_me
FROM public.leaderboard_trophies_rows();

-- Signup trigger: same empty search_path, still not callable by clients.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.players (user_id, username)
  VALUES (NEW.id, 'Player_' || pg_catalog.left(NEW.id::text, 8))
  ON CONFLICT (user_id) DO NOTHING;

  INSERT INTO public.user_gems (user_id, gems, total_purchased)
  VALUES (NEW.id, 0, 0)
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------------
-- Policies for the three tables that had RLS and none.
-- Privileges stay revoked from anon and authenticated below: the policy is
-- the row bound, the missing grant is what keeps PostgREST off the table.
-- put_player_save is the only writer of a save, so a direct UPDATE cannot
-- skip the compare-and-swap. checkout_holds and rate_limits are written by
-- the service role (and by security-definer functions running as owner).
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "player_saves_select_own" ON public.player_saves;
DROP POLICY IF EXISTS "player_saves_insert_own" ON public.player_saves;
DROP POLICY IF EXISTS "player_saves_update_own" ON public.player_saves;
DROP POLICY IF EXISTS "player_saves_delete_own" ON public.player_saves;
CREATE POLICY "player_saves_select_own"
  ON public.player_saves FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);
CREATE POLICY "player_saves_insert_own"
  ON public.player_saves FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "player_saves_update_own"
  ON public.player_saves FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "player_saves_delete_own"
  ON public.player_saves FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "checkout_holds_service_role" ON public.checkout_holds;
CREATE POLICY "checkout_holds_service_role"
  ON public.checkout_holds FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "rate_limits_service_role" ON public.rate_limits;
CREATE POLICY "rate_limits_service_role"
  ON public.rate_limits FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ---------------------------------------------------------------------------
-- Grants. Supabase's default privileges hand a new function to anon directly;
-- REVOKE FROM public does not remove that grant.
-- ---------------------------------------------------------------------------

REVOKE ALL ON FUNCTION public.check_rate_limit(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.check_rate_limit(TEXT) TO authenticated;

REVOKE ALL ON FUNCTION public.upsert_player_profile(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.upsert_player_profile(TEXT) TO authenticated;

REVOKE ALL ON FUNCTION public.set_player_username(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_player_username(TEXT) TO authenticated;

REVOKE ALL ON FUNCTION public.sync_battle_result(BOOLEAN, INTEGER, INTEGER, INTEGER) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.sync_battle_result(BOOLEAN, INTEGER, INTEGER, INTEGER) TO authenticated;

REVOKE ALL ON FUNCTION public.sync_player_level(INTEGER, INTEGER) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.sync_player_level(INTEGER, INTEGER) TO authenticated;

REVOKE ALL ON FUNCTION public.get_player_save() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_player_save() TO authenticated;

REVOKE ALL ON FUNCTION public.put_player_save(JSONB, BIGINT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.put_player_save(JSONB, BIGINT) TO authenticated;

REVOKE ALL ON FUNCTION public.get_my_rank() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_rank() TO authenticated;

REVOKE ALL ON FUNCTION public.leaderboard_rows() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.leaderboard_rows() TO anon, authenticated;

REVOKE ALL ON FUNCTION public.leaderboard_trophies_rows() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.leaderboard_trophies_rows() TO anon, authenticated;

REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

REVOKE ALL ON public.leaderboard FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.leaderboard TO anon, authenticated;
REVOKE ALL ON public.leaderboard_trophies FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.leaderboard_trophies TO anon, authenticated;

REVOKE ALL ON public.player_saves FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.checkout_holds FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.checkout_holds TO service_role;
REVOKE ALL ON public.rate_limits FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.rate_limits TO service_role;
