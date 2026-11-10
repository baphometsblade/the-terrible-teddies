-- Push notifications. Opt-in. One transaction.
--
-- Web Push is sent by the edge function send-push (verify_jwt = true, and
-- the function itself refuses any JWT that is not the service role). A row
-- in push_outbox is the job. A Database Webhook on INSERT of that table,
-- or pg_net when it is installed and app.push_webhook_url is set, calls
-- the function. See docs/PUSH_SETUP.md.
--
-- push_inbox is what the open game toasts over Realtime. Quiet hours and a
-- focused tab skip the web push and still write the inbox row.
--
-- Live PvP (20261110130000_pvp_matches) is not on this branch. After a turn
-- the match function should call, as the table owner:
--   PERFORM public.push_your_turn(match_id, next_user, actor_user);
-- That function is not granted to clients. A focused tab (player_focus,
-- fresh for two minutes) gets the toast only.
--
-- Numbers shared with src/lib/push/policy.js: friend-online debounce 4 hours,
-- 10 web-or-inbox pings an hour, quiet hours default 02:00–08:00 local,
-- focus is fresh for 2 minutes.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.notification_prefs (
  user_id            UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  enabled            BOOLEAN NOT NULL DEFAULT FALSE,
  friends_online     BOOLEAN NOT NULL DEFAULT TRUE,
  challenges         BOOLEAN NOT NULL DEFAULT TRUE,
  your_turn          BOOLEAN NOT NULL DEFAULT TRUE,
  quiet_enabled      BOOLEAN NOT NULL DEFAULT TRUE,
  quiet_start        SMALLINT NOT NULL DEFAULT 2,
  quiet_end          SMALLINT NOT NULL DEFAULT 8,
  tz_offset_minutes  INTEGER NOT NULL DEFAULT 0,
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.now(),
  CONSTRAINT notification_prefs_hours CHECK (quiet_start BETWEEN 0 AND 23 AND quiet_end BETWEEN 0 AND 23),
  CONSTRAINT notification_prefs_tz CHECK (tz_offset_minutes BETWEEN -840 AND 840)
);

CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id         UUID PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint   TEXT NOT NULL,
  p256dh     TEXT NOT NULL,
  auth       TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.now(),
  CONSTRAINT push_subscriptions_endpoint UNIQUE (user_id, endpoint)
);

CREATE TABLE IF NOT EXISTS public.push_outbox (
  id         UUID PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind       TEXT NOT NULL,
  title      TEXT NOT NULL,
  body       TEXT NOT NULL,
  url        TEXT NOT NULL DEFAULT '/',
  created_at TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.now(),
  sent_at    TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.push_inbox (
  id         UUID PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind       TEXT NOT NULL,
  title      TEXT NOT NULL,
  body       TEXT NOT NULL,
  url        TEXT NOT NULL DEFAULT '/',
  created_at TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.now()
);

CREATE INDEX IF NOT EXISTS push_inbox_user_idx
  ON public.push_inbox (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.push_debounce (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind    TEXT NOT NULL,
  actor   UUID NOT NULL,
  last_at TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.now(),
  PRIMARY KEY (user_id, kind, actor)
);

CREATE TABLE IF NOT EXISTS public.push_hourly (
  user_id      UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  window_start TIMESTAMPTZ NOT NULL,
  sent         INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS public.player_focus (
  user_id    UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  focused    BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.now()
);

CREATE TABLE IF NOT EXISTS public.player_presence (
  user_id    UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  status     TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.now(),
  CONSTRAINT player_presence_status CHECK (status IN ('offline', 'online', 'bar', 'match'))
);

ALTER TABLE public.notification_prefs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.push_outbox ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.push_inbox ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.push_debounce ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.push_hourly ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.player_focus ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.player_presence ENABLE ROW LEVEL SECURITY;

-- The open game reads its own toasts. Nothing else is client-readable.
DROP POLICY IF EXISTS push_inbox_own ON public.push_inbox;
CREATE POLICY push_inbox_own ON public.push_inbox
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

REVOKE ALL ON public.notification_prefs FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.push_subscriptions FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.push_outbox FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.push_inbox FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.push_debounce FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.push_hourly FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.player_focus FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.player_presence FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.push_inbox TO authenticated;

DO $do$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_catalog.pg_publication WHERE pubname = 'supabase_realtime') THEN
    BEGIN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.push_inbox;
    EXCEPTION WHEN duplicate_object THEN
      NULL;
    END;
  END IF;
END
$do$;

-- ---------------------------------------------------------------------------
-- Rate limit: the same function, plus the push actions.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.social_rate_limit(p_action_type TEXT)
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
    WHEN 'social_publish' THEN v_max := 6;  v_window := 3600;
    WHEN 'social_ticket'  THEN v_max := 8;  v_window := 600;
    WHEN 'social_result'  THEN v_max := 10; v_window := 600;
    WHEN 'social_follow'  THEN v_max := 20; v_window := 3600;
    WHEN 'social_gang'    THEN v_max := 6;  v_window := 3600;
    WHEN 'social_cup'     THEN v_max := 8;  v_window := 600;
    WHEN 'social_taunt'   THEN v_max := 12; v_window := 600;
    WHEN 'social_report'  THEN v_max := 5;  v_window := 86400;
    WHEN 'social_refer'   THEN v_max := 4;  v_window := 86400;
    WHEN 'social_rival'   THEN v_max := 10; v_window := 3600;
    WHEN 'social_lineup'  THEN v_max := 20; v_window := 600;
    WHEN 'social_friend'  THEN v_max := 20; v_window := 3600;
    WHEN 'social_invite_make' THEN v_max := 8;  v_window := 86400;
    WHEN 'social_invite_take' THEN v_max := 10; v_window := 86400;
    WHEN 'social_search'  THEN v_max := 30; v_window := 600;
    WHEN 'social_guilds'  THEN v_max := 6;  v_window := 3600;
    WHEN 'social_challenge' THEN v_max := 12; v_window := 3600;
    WHEN 'social_block'   THEN v_max := 10; v_window := 86400;
    WHEN 'social_presence' THEN v_max := 20; v_window := 3600;
    WHEN 'push_sub'       THEN v_max := 10; v_window := 3600;
    WHEN 'push_pref'      THEN v_max := 30; v_window := 3600;
    WHEN 'push_focus'     THEN v_max := 120; v_window := 3600;
    WHEN 'push_presence'  THEN v_max := 20; v_window := 3600;
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

REVOKE ALL ON FUNCTION public.social_rate_limit(TEXT) FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Copy and the enqueue decision. A failure here must not undo a friendship,
-- so the triggers swallow errors.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.push_line(p_kind TEXT, p_name TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT CASE p_kind
    WHEN 'friends_online' THEN p_name || ' just walked in. Try to look busy.'
    WHEN 'challenge_live' THEN p_name || ' wants it in person. How rude.'
    WHEN 'challenge_ghost' THEN p_name || ' left a deck with your name on it.'
    WHEN 'accept_request' THEN p_name || ' said yes. Terrible judgment, the both of you.'
    WHEN 'accept_challenge' THEN p_name || ' picked up. Don''t get shy now.'
    WHEN 'your_turn' THEN 'Your turn, darling. Don''t keep them waiting.'
    ELSE 'The bar has something for you.'
  END;
$$;

REVOKE ALL ON FUNCTION public.push_line(TEXT, TEXT) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.push_title(p_kind TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT CASE p_kind
    WHEN 'friends_online' THEN 'They walked in'
    WHEN 'challenge_live' THEN 'A live dare'
    WHEN 'challenge_ghost' THEN 'A deck was left out'
    WHEN 'accept_request' THEN 'They said yes'
    WHEN 'accept_challenge' THEN 'They picked up'
    WHEN 'your_turn' THEN 'Your turn'
    ELSE 'The bar'
  END;
$$;

REVOKE ALL ON FUNCTION public.push_title(TEXT) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.push_quiet(p_user UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_row   public.notification_prefs%ROWTYPE;
  v_local TIMESTAMPTZ;
  v_hour  INTEGER;
BEGIN
  SELECT * INTO v_row FROM public.notification_prefs WHERE user_id = p_user;
  IF NOT FOUND OR NOT v_row.quiet_enabled OR v_row.quiet_start = v_row.quiet_end THEN
    RETURN FALSE;
  END IF;
  v_local := pg_catalog.now() + make_interval(mins => v_row.tz_offset_minutes);
  v_hour := pg_catalog.date_part('hour', v_local)::integer;
  IF v_row.quiet_start < v_row.quiet_end THEN
    RETURN v_hour >= v_row.quiet_start AND v_hour < v_row.quiet_end;
  END IF;
  RETURN v_hour >= v_row.quiet_start OR v_hour < v_row.quiet_end;
END;
$$;

REVOKE ALL ON FUNCTION public.push_quiet(UUID) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.push_kind_on(p_user UUID, p_kind TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.notification_prefs p
    WHERE p.user_id = p_user
      AND p.enabled
      AND CASE
        WHEN p_kind = 'friends_online' THEN p.friends_online
        WHEN p_kind IN ('challenge_live', 'challenge_ghost', 'accept_request', 'accept_challenge') THEN p.challenges
        WHEN p_kind = 'your_turn' THEN p.your_turn
        ELSE FALSE
      END
  );
$$;

REVOKE ALL ON FUNCTION public.push_kind_on(UUID, TEXT) FROM PUBLIC, anon, authenticated;

-- p_web is the caller's wish (false when the tab is focused on a turn).
-- Quiet hours also drop the web push. Debounce and the hourly cap drop both.
CREATE OR REPLACE FUNCTION public.push_enqueue(
  p_user UUID,
  p_kind TEXT,
  p_actor UUID,
  p_url TEXT,
  p_web BOOLEAN
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_name   TEXT;
  v_title  TEXT;
  v_body   TEXT;
  v_last   TIMESTAMPTZ;
  v_window TIMESTAMPTZ;
  v_sent   INTEGER;
  v_web    BOOLEAN;
BEGIN
  IF p_user IS NULL OR p_actor IS NULL OR p_user = p_actor THEN
    RETURN FALSE;
  END IF;
  IF public.social_blocked(p_user, p_actor) THEN
    RETURN FALSE;
  END IF;
  IF NOT public.push_kind_on(p_user, p_kind) THEN
    RETURN FALSE;
  END IF;

  IF p_kind = 'friends_online' THEN
    SELECT last_at INTO v_last FROM public.push_debounce
    WHERE user_id = p_user AND kind = p_kind AND actor = p_actor;
    IF v_last IS NOT NULL AND v_last > pg_catalog.now() - INTERVAL '4 hours' THEN
      RETURN FALSE;
    END IF;
  END IF;

  SELECT window_start, sent INTO v_window, v_sent
  FROM public.push_hourly WHERE user_id = p_user FOR UPDATE;
  IF NOT FOUND OR v_window < pg_catalog.now() - INTERVAL '1 hour' THEN
    INSERT INTO public.push_hourly (user_id, window_start, sent)
    VALUES (p_user, pg_catalog.now(), 0)
    ON CONFLICT (user_id) DO UPDATE
      SET window_start = pg_catalog.now(), sent = 0;
    v_sent := 0;
  ELSIF v_sent >= 10 THEN
    RETURN FALSE;
  END IF;

  v_name := public.ladder_display_name(p_actor);
  v_title := public.push_title(p_kind);
  v_body := public.push_line(p_kind, v_name);
  v_web := COALESCE(p_web, true) AND NOT public.push_quiet(p_user);

  INSERT INTO public.push_inbox (user_id, kind, title, body, url)
  VALUES (p_user, p_kind, v_title, v_body, COALESCE(NULLIF(p_url, ''), '/'));

  IF v_web THEN
    INSERT INTO public.push_outbox (user_id, kind, title, body, url)
    VALUES (p_user, p_kind, v_title, v_body, COALESCE(NULLIF(p_url, ''), '/'));
  END IF;

  INSERT INTO public.push_debounce (user_id, kind, actor, last_at)
  VALUES (p_user, p_kind, p_actor, pg_catalog.now())
  ON CONFLICT (user_id, kind, actor) DO UPDATE SET last_at = pg_catalog.now();

  UPDATE public.push_hourly SET sent = sent + 1 WHERE user_id = p_user;
  RETURN TRUE;
END;
$$;

REVOKE ALL ON FUNCTION public.push_enqueue(UUID, TEXT, UUID, TEXT, BOOLEAN) FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Triggers. A ping must not roll back the thing that caused it.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.push_on_friend_challenge()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  BEGIN
    IF TG_OP = 'INSERT' THEN
      PERFORM public.push_enqueue(
        NEW.friend_id,
        CASE WHEN NEW.mode = 'live' THEN 'challenge_live' ELSE 'challenge_ghost' END,
        NEW.challenger_id,
        '/?social=room',
        TRUE
      );
    ELSIF TG_OP = 'UPDATE'
      AND OLD.status IS DISTINCT FROM 'accepted'
      AND NEW.status = 'accepted' THEN
      PERFORM public.push_enqueue(
        NEW.challenger_id,
        'accept_challenge',
        NEW.friend_id,
        '/?social=room',
        TRUE
      );
    END IF;
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.push_on_friend_challenge() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS push_friend_challenge ON public.friend_challenges;
CREATE TRIGGER push_friend_challenge
  AFTER INSERT OR UPDATE OF status ON public.friend_challenges
  FOR EACH ROW EXECUTE FUNCTION public.push_on_friend_challenge();

CREATE OR REPLACE FUNCTION public.push_on_friend_accept()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  BEGIN
    IF TG_OP = 'UPDATE'
      AND OLD.status IS DISTINCT FROM 'accepted'
      AND NEW.status = 'accepted' THEN
      PERFORM public.push_enqueue(
        NEW.from_user,
        'accept_request',
        NEW.to_user,
        '/?social=room',
        TRUE
      );
    END IF;
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.push_on_friend_accept() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS push_friend_accept ON public.friend_requests;
CREATE TRIGGER push_friend_accept
  AFTER UPDATE OF status ON public.friend_requests
  FOR EACH ROW EXECUTE FUNCTION public.push_on_friend_accept();

-- ---------------------------------------------------------------------------
-- Client calls: prefs, the subscription, focus, and coming online.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.my_notification_prefs()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_row public.notification_prefs%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not signed in' USING ERRCODE = 'PT401';
  END IF;
  SELECT * INTO v_row FROM public.notification_prefs WHERE user_id = v_uid;
  IF NOT FOUND THEN
    RETURN pg_catalog.jsonb_build_object(
      'ok', true, 'enabled', false,
      'friends_online', true, 'challenges', true, 'your_turn', true,
      'quiet_enabled', true, 'quiet_start', 2, 'quiet_end', 8,
      'tz_offset_minutes', 0
    );
  END IF;
  RETURN pg_catalog.jsonb_build_object(
    'ok', true,
    'enabled', v_row.enabled,
    'friends_online', v_row.friends_online,
    'challenges', v_row.challenges,
    'your_turn', v_row.your_turn,
    'quiet_enabled', v_row.quiet_enabled,
    'quiet_start', v_row.quiet_start,
    'quiet_end', v_row.quiet_end,
    'tz_offset_minutes', v_row.tz_offset_minutes
  );
END;
$$;

REVOKE ALL ON FUNCTION public.my_notification_prefs() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_notification_prefs() TO authenticated;

CREATE OR REPLACE FUNCTION public.set_notification_prefs(
  p_enabled BOOLEAN,
  p_friends BOOLEAN,
  p_challenges BOOLEAN,
  p_turn BOOLEAN,
  p_quiet BOOLEAN,
  p_start INTEGER,
  p_end INTEGER,
  p_tz INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_start INTEGER := COALESCE(p_start, 2);
  v_end INTEGER := COALESCE(p_end, 8);
  v_tz INTEGER := COALESCE(p_tz, 0);
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not signed in' USING ERRCODE = 'PT401';
  END IF;
  IF NOT public.social_rate_limit('push_pref') THEN
    RETURN pg_catalog.jsonb_build_object('ok', false, 'reason', 'slow');
  END IF;
  IF v_start < 0 OR v_start > 23 OR v_end < 0 OR v_end > 23 OR v_tz < -840 OR v_tz > 840 THEN
    RETURN pg_catalog.jsonb_build_object('ok', false, 'reason', 'missing');
  END IF;
  INSERT INTO public.notification_prefs (
    user_id, enabled, friends_online, challenges, your_turn,
    quiet_enabled, quiet_start, quiet_end, tz_offset_minutes
  ) VALUES (
    v_uid,
    COALESCE(p_enabled, false),
    COALESCE(p_friends, true),
    COALESCE(p_challenges, true),
    COALESCE(p_turn, true),
    COALESCE(p_quiet, true),
    v_start, v_end, v_tz
  )
  ON CONFLICT (user_id) DO UPDATE SET
    enabled = EXCLUDED.enabled,
    friends_online = EXCLUDED.friends_online,
    challenges = EXCLUDED.challenges,
    your_turn = EXCLUDED.your_turn,
    quiet_enabled = EXCLUDED.quiet_enabled,
    quiet_start = EXCLUDED.quiet_start,
    quiet_end = EXCLUDED.quiet_end,
    tz_offset_minutes = EXCLUDED.tz_offset_minutes,
    updated_at = pg_catalog.now();
  RETURN public.my_notification_prefs();
END;
$$;

REVOKE ALL ON FUNCTION public.set_notification_prefs(BOOLEAN, BOOLEAN, BOOLEAN, BOOLEAN, BOOLEAN, INTEGER, INTEGER, INTEGER) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_notification_prefs(BOOLEAN, BOOLEAN, BOOLEAN, BOOLEAN, BOOLEAN, INTEGER, INTEGER, INTEGER) TO authenticated;

CREATE OR REPLACE FUNCTION public.save_push_subscription(
  p_endpoint TEXT,
  p_p256dh TEXT,
  p_auth TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_endpoint TEXT := pg_catalog.btrim(COALESCE(p_endpoint, ''));
  v_p256 TEXT := pg_catalog.btrim(COALESCE(p_p256dh, ''));
  v_auth TEXT := pg_catalog.btrim(COALESCE(p_auth, ''));
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not signed in' USING ERRCODE = 'PT401';
  END IF;
  IF NOT public.social_rate_limit('push_sub') THEN
    RETURN pg_catalog.jsonb_build_object('ok', false, 'reason', 'slow');
  END IF;
  IF v_endpoint !~ '^https://' OR pg_catalog.char_length(v_endpoint) > 2000
     OR pg_catalog.char_length(v_p256) < 8 OR pg_catalog.char_length(v_p256) > 200
     OR pg_catalog.char_length(v_auth) < 8 OR pg_catalog.char_length(v_auth) > 200 THEN
    RETURN pg_catalog.jsonb_build_object('ok', false, 'reason', 'missing');
  END IF;
  INSERT INTO public.push_subscriptions (user_id, endpoint, p256dh, auth)
  VALUES (v_uid, v_endpoint, v_p256, v_auth)
  ON CONFLICT (user_id, endpoint) DO UPDATE
    SET p256dh = EXCLUDED.p256dh, auth = EXCLUDED.auth;
  RETURN pg_catalog.jsonb_build_object('ok', true);
END;
$$;

REVOKE ALL ON FUNCTION public.save_push_subscription(TEXT, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_push_subscription(TEXT, TEXT, TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.delete_push_subscription(p_endpoint TEXT)
RETURNS JSONB
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
  DELETE FROM public.push_subscriptions
  WHERE user_id = v_uid AND endpoint = pg_catalog.btrim(COALESCE(p_endpoint, ''));
  RETURN pg_catalog.jsonb_build_object('ok', true);
END;
$$;

REVOKE ALL ON FUNCTION public.delete_push_subscription(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_push_subscription(TEXT) TO authenticated;

-- The edge function calls this with the service role after a 404 or 410.
CREATE OR REPLACE FUNCTION public.drop_push_endpoint(p_endpoint TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  DELETE FROM public.push_subscriptions
  WHERE endpoint = pg_catalog.btrim(COALESCE(p_endpoint, ''));
END;
$$;

REVOKE ALL ON FUNCTION public.drop_push_endpoint(TEXT) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.mark_push_sent(p_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  UPDATE public.push_outbox SET sent_at = pg_catalog.now() WHERE id = p_id AND sent_at IS NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.mark_push_sent(UUID) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.set_tab_focused(p_focused BOOLEAN)
RETURNS JSONB
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
  IF NOT public.social_rate_limit('push_focus') THEN
    RETURN pg_catalog.jsonb_build_object('ok', false, 'reason', 'slow');
  END IF;
  INSERT INTO public.player_focus (user_id, focused)
  VALUES (v_uid, COALESCE(p_focused, false))
  ON CONFLICT (user_id) DO UPDATE
    SET focused = EXCLUDED.focused, updated_at = pg_catalog.now();
  RETURN pg_catalog.jsonb_build_object('ok', true, 'focused', COALESCE(p_focused, false));
END;
$$;

REVOKE ALL ON FUNCTION public.set_tab_focused(BOOLEAN) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_tab_focused(BOOLEAN) TO authenticated;

CREATE OR REPLACE FUNCTION public.report_presence(p_status TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid     UUID := auth.uid();
  v_status  TEXT := pg_catalog.lower(pg_catalog.btrim(COALESCE(p_status, '')));
  v_prev    TEXT;
  v_off     BOOLEAN;
  v_friend  UUID;
  v_was     BOOLEAN;
  v_now     BOOLEAN;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not signed in' USING ERRCODE = 'PT401';
  END IF;
  IF v_status NOT IN ('offline', 'online', 'bar', 'match') THEN
    RETURN pg_catalog.jsonb_build_object('ok', false, 'reason', 'missing');
  END IF;

  SELECT appear_offline INTO v_off FROM public.presence_prefs WHERE user_id = v_uid;
  IF COALESCE(v_off, false) THEN
    v_status := 'offline';
  END IF;

  SELECT status INTO v_prev FROM public.player_presence WHERE user_id = v_uid;
  INSERT INTO public.player_presence (user_id, status)
  VALUES (v_uid, v_status)
  ON CONFLICT (user_id) DO UPDATE
    SET status = EXCLUDED.status, updated_at = pg_catalog.now();

  v_was := COALESCE(v_prev IN ('online', 'bar', 'match'), false);
  v_now := v_status IN ('online', 'bar', 'match');
  IF v_now AND NOT v_was AND public.social_rate_limit('push_presence') THEN
    FOR v_friend IN
      SELECT CASE WHEN f.user_low = v_uid THEN f.user_high ELSE f.user_low END
      FROM public.friendships f
      WHERE f.user_low = v_uid OR f.user_high = v_uid
    LOOP
      PERFORM public.push_enqueue(v_friend, 'friends_online', v_uid, '/?social=room', TRUE);
    END LOOP;
  END IF;

  RETURN pg_catalog.jsonb_build_object('ok', true, 'status', v_status);
END;
$$;

REVOKE ALL ON FUNCTION public.report_presence(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.report_presence(TEXT) TO authenticated;

-- Not granted to clients. PvP's security-definer turn function calls it.
CREATE OR REPLACE FUNCTION public.push_your_turn(
  p_match UUID,
  p_recipient UUID,
  p_actor UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_focused BOOLEAN := FALSE;
BEGIN
  IF p_match IS NULL OR p_recipient IS NULL OR p_actor IS NULL OR p_recipient = p_actor THEN
    RETURN;
  END IF;
  SELECT focused AND updated_at > pg_catalog.now() - INTERVAL '2 minutes'
    INTO v_focused
  FROM public.player_focus
  WHERE user_id = p_recipient;
  PERFORM public.push_enqueue(
    p_recipient,
    'your_turn',
    p_actor,
    '/',
    NOT COALESCE(v_focused, false)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.push_your_turn(UUID, UUID, UUID) FROM PUBLIC, anon, authenticated;

-- The recipient of a live dare. Sets status to accepted; the trigger tells
-- the challenger. Ghost dares are already a fight, so this is for live.
CREATE OR REPLACE FUNCTION public.accept_friend_challenge(p_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_row public.friend_challenges%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not signed in' USING ERRCODE = 'PT401';
  END IF;
  SELECT * INTO v_row FROM public.friend_challenges WHERE id = p_id FOR UPDATE;
  IF NOT FOUND OR v_row.friend_id <> v_uid OR v_row.status <> 'open' THEN
    RETURN pg_catalog.jsonb_build_object('ok', false, 'reason', 'missing');
  END IF;
  UPDATE public.friend_challenges SET status = 'accepted' WHERE id = p_id;
  RETURN pg_catalog.jsonb_build_object('ok', true, 'status', 'accepted');
END;
$$;

REVOKE ALL ON FUNCTION public.accept_friend_challenge(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.accept_friend_challenge(UUID) TO authenticated;

GRANT EXECUTE ON FUNCTION public.drop_push_endpoint(TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.mark_push_sent(UUID) TO service_role;
