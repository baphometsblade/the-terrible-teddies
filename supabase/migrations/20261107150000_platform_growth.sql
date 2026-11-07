-- Platform: feature flags, a staff desk, activity counts, and account
-- export / deletion. Idempotent. One transaction, as `supabase db push`
-- applies each file.
--
-- Clients may SELECT feature_flags (the rows are not personal) and their own
-- admins row. They cannot write either table. Counts, the export and the
-- deletion go through SECURITY DEFINER functions that use auth.uid(), pin
-- search_path, and spend check_rate_limit. The match counter is a daily
-- total, not a row per player.

-- The window and the user both come from the server. New actions are added
-- here; anything else is still rejected rather than defaulted.
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

  CASE p_action_type
    WHEN 'checkout'      THEN v_max := 5;  v_window := 60;
    WHEN 'battle_result' THEN v_max := 5;  v_window := 60;
    WHEN 'level_sync'    THEN v_max := 5;  v_window := 60;
    WHEN 'admin_stats'   THEN v_max := 30; v_window := 60;
    WHEN 'activity_ping' THEN v_max := 12; v_window := 60;
    WHEN 'match_log'     THEN v_max := 30; v_window := 60;
    WHEN 'data_export'   THEN v_max := 3;  v_window := 3600;
    WHEN 'data_delete'   THEN v_max := 2;  v_window := 86400;
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

ALTER TABLE public.players
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- ---------------------------------------------------------------------------
-- Flags. Readable by anyone, writable by nobody who holds the anon key.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.feature_flags (
  key         TEXT        PRIMARY KEY,
  enabled     BOOLEAN     NOT NULL DEFAULT FALSE,
  description TEXT        NOT NULL DEFAULT '',
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT feature_flags_key_format CHECK (key ~ '^[a-z][a-z0-9_]{0,40}$')
);

ALTER TABLE public.feature_flags ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS feature_flags_read ON public.feature_flags;
CREATE POLICY feature_flags_read
  ON public.feature_flags FOR SELECT
  TO anon, authenticated
  USING (TRUE);

REVOKE ALL ON public.feature_flags FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.feature_flags TO anon, authenticated;

INSERT INTO public.feature_flags (key, enabled, description) VALUES
  ('public_landing', TRUE, 'SFW marketing page before the age door'),
  ('consent_banner', TRUE, 'Cookie notice before product analytics'),
  ('admin_dashboard', TRUE, 'Staff counts route')
ON CONFLICT (key) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Staff. A signed-in player can see their own row and no one else's.
-- Rows are inserted by the database owner, never by a client.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.admins (
  user_id    UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.admins ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS admins_select_self ON public.admins;
CREATE POLICY admins_select_self
  ON public.admins FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

REVOKE ALL ON public.admins FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.admins TO authenticated;

-- ---------------------------------------------------------------------------
-- Who was here today, and how many matches were played. No names.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.player_activity (
  user_id UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS player_activity_seen_at_idx
  ON public.player_activity (seen_at);

ALTER TABLE public.player_activity ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.player_activity FROM PUBLIC, anon, authenticated;

CREATE TABLE IF NOT EXISTS public.growth_daily (
  day     DATE    PRIMARY KEY,
  matches INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT growth_daily_matches_range CHECK (matches >= 0 AND matches <= 100000000)
);

ALTER TABLE public.growth_daily ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.growth_daily FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.touch_player_activity()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid UUID := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not signed in' USING ERRCODE = 'PT401';
  END IF;
  IF NOT public.check_rate_limit('activity_ping') THEN
    RETURN;
  END IF;

  INSERT INTO public.player_activity (user_id, seen_at)
  VALUES (v_uid, pg_catalog.now())
  ON CONFLICT (user_id) DO UPDATE
    SET seen_at = pg_catalog.now();
END;
$$;

CREATE OR REPLACE FUNCTION public.log_played_match(p_won BOOLEAN)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_day DATE := (pg_catalog.now() AT TIME ZONE 'utc')::DATE;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not signed in' USING ERRCODE = 'PT401';
  END IF;
  IF p_won IS NULL THEN
    RETURN;
  END IF;
  IF NOT public.check_rate_limit('match_log') THEN
    RETURN;
  END IF;

  INSERT INTO public.player_activity (user_id, seen_at)
  VALUES (v_uid, pg_catalog.now())
  ON CONFLICT (user_id) DO UPDATE
    SET seen_at = pg_catalog.now();

  INSERT INTO public.growth_daily (day, matches)
  VALUES (v_day, 1)
  ON CONFLICT (day) DO UPDATE
    SET matches = CASE
      WHEN public.growth_daily.matches >= 100000000 THEN public.growth_daily.matches
      ELSE public.growth_daily.matches + 1
    END;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_growth_stats()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid     UUID := auth.uid();
  v_signups BIGINT;
  v_dau     BIGINT;
  v_today   BIGINT;
  v_matches BIGINT;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not signed in' USING ERRCODE = 'PT401';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.admins WHERE user_id = v_uid) THEN
    RAISE EXCEPTION 'not an admin' USING ERRCODE = 'PT403';
  END IF;
  IF NOT public.check_rate_limit('admin_stats') THEN
    RAISE EXCEPTION 'slow down' USING ERRCODE = 'PT429';
  END IF;

  SELECT count(*) INTO v_signups FROM auth.users;
  SELECT count(*) INTO v_dau
  FROM public.player_activity
  WHERE seen_at >= pg_catalog.now() - INTERVAL '1 day';
  SELECT COALESCE(sum(matches), 0) INTO v_matches FROM public.growth_daily;
  SELECT COALESCE(sum(matches), 0) INTO v_today
  FROM public.growth_daily
  WHERE day = (pg_catalog.now() AT TIME ZONE 'utc')::DATE;

  RETURN pg_catalog.jsonb_build_object(
    'signups', v_signups,
    'dau', v_dau,
    'matches_today', v_today,
    'matches', v_matches,
    'generated_at', pg_catalog.now()
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- The account's own copy, and the account's own deletion.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.export_my_data()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid       UUID := auth.uid();
  v_email     TEXT;
  v_player    JSONB;
  v_save      JSONB;
  v_gems      JSONB;
  v_purchases JSONB;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not signed in' USING ERRCODE = 'PT401';
  END IF;
  IF NOT public.check_rate_limit('data_export') THEN
    RAISE EXCEPTION 'slow down' USING ERRCODE = 'PT429';
  END IF;

  SELECT email INTO v_email FROM auth.users WHERE id = v_uid;

  SELECT pg_catalog.jsonb_build_object(
    'username', username,
    'coins', coins,
    'wins', wins,
    'losses', losses,
    'level', level,
    'xp', xp,
    'created_at', created_at
  ) INTO v_player
  FROM public.players
  WHERE user_id = v_uid;

  SELECT save INTO v_save FROM public.player_saves WHERE user_id = v_uid;

  SELECT pg_catalog.jsonb_build_object(
    'gems', gems,
    'total_purchased', total_purchased
  ) INTO v_gems
  FROM public.user_gems
  WHERE user_id = v_uid;

  SELECT COALESCE(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
    'bundle_id', bundle_id,
    'gems_granted', gems_granted,
    'amount_paid', amount_paid,
    'status', status,
    'created_at', created_at
  ) ORDER BY created_at), '[]'::JSONB)
  INTO v_purchases
  FROM public.purchases
  WHERE user_id = v_uid;

  RETURN pg_catalog.jsonb_build_object(
    'exported_at', pg_catalog.now(),
    'email', v_email,
    'player', v_player,
    'save', v_save,
    'gems', v_gems,
    'purchases', COALESCE(v_purchases, '[]'::JSONB)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_my_account()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid UUID := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not signed in' USING ERRCODE = 'PT401';
  END IF;
  IF NOT public.check_rate_limit('data_delete') THEN
    RAISE EXCEPTION 'slow down' USING ERRCODE = 'PT429';
  END IF;

  -- rate_limits has no foreign key, so it would survive the account.
  DELETE FROM public.rate_limits WHERE user_id = v_uid;
  -- The rest follows the account: players, saves, gems, holds, activity, staff.
  -- purchases.user_id is ON DELETE SET NULL, so the sale stays and the person does not.
  DELETE FROM auth.users WHERE id = v_uid;
END;
$$;

REVOKE ALL ON FUNCTION public.touch_player_activity() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.touch_player_activity() TO authenticated;

REVOKE ALL ON FUNCTION public.log_played_match(BOOLEAN) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.log_played_match(BOOLEAN) TO authenticated;

REVOKE ALL ON FUNCTION public.admin_growth_stats() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_growth_stats() TO authenticated;

REVOKE ALL ON FUNCTION public.export_my_data() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.export_my_data() TO authenticated;

REVOKE ALL ON FUNCTION public.delete_my_account() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_my_account() TO authenticated;
