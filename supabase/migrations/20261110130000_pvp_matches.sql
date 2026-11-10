-- Live Pub Brawl. The edge function is the only writer. Clients may select
-- their own projected row in pvp_views and nothing else: the opponent's hand
-- and both deck orders live in pvp_matches.state, which no client role can read.
-- Idempotent. One transaction, as `supabase db push` applies each file.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.pvp_matches (
  id           UUID PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
  kind         TEXT NOT NULL,
  status       TEXT NOT NULL DEFAULT 'active',
  version      INTEGER NOT NULL DEFAULT 1,
  seed         INTEGER NOT NULL,
  state        JSONB NOT NULL,
  setup        JSONB NOT NULL,
  rules        JSONB NOT NULL,
  night        JSONB,
  state_hash   TEXT NOT NULL,
  winner_seat  TEXT,
  finish_reason TEXT,
  deadline     TIMESTAMPTZ,
  grace_used   BOOLEAN NOT NULL DEFAULT FALSE,
  gang_id      UUID,
  invite_code  TEXT,
  result       JSONB,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.now(),
  finished_at  TIMESTAMPTZ,
  CONSTRAINT pvp_matches_kind CHECK (kind IN ('ladder', 'friend', 'gang')),
  CONSTRAINT pvp_matches_status CHECK (status IN ('active', 'finished'))
);

CREATE INDEX IF NOT EXISTS pvp_matches_due_idx
  ON public.pvp_matches (deadline)
  WHERE status = 'active';

CREATE TABLE IF NOT EXISTS public.pvp_players (
  match_id   UUID NOT NULL REFERENCES public.pvp_matches(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  seat       TEXT NOT NULL,
  rating     INTEGER NOT NULL,
  display_name TEXT NOT NULL,
  last_seen  TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.now(),
  connected  BOOLEAN NOT NULL DEFAULT TRUE,
  PRIMARY KEY (match_id, user_id),
  CONSTRAINT pvp_players_seat CHECK (seat IN ('a', 'b')),
  UNIQUE (match_id, seat)
);

CREATE INDEX IF NOT EXISTS pvp_players_user_idx ON public.pvp_players (user_id);

CREATE TABLE IF NOT EXISTS public.pvp_actions (
  match_id   UUID NOT NULL REFERENCES public.pvp_matches(id) ON DELETE CASCADE,
  action_id  UUID NOT NULL,
  user_id    UUID NOT NULL,
  turn_number INTEGER NOT NULL,
  version    INTEGER NOT NULL,
  intent     JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.now(),
  PRIMARY KEY (match_id, action_id)
);

CREATE INDEX IF NOT EXISTS pvp_actions_order_idx
  ON public.pvp_actions (match_id, created_at, action_id);

CREATE TABLE IF NOT EXISTS public.pvp_views (
  match_id   UUID NOT NULL REFERENCES public.pvp_matches(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  version    INTEGER NOT NULL,
  payload    JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.now(),
  PRIMARY KEY (match_id, user_id)
);

ALTER TABLE public.pvp_views REPLICA IDENTITY FULL;

CREATE TABLE IF NOT EXISTS public.pvp_queue (
  user_id      UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  deck         INTEGER[] NOT NULL,
  rating       INTEGER NOT NULL,
  display_name TEXT NOT NULL,
  status       TEXT NOT NULL DEFAULT 'waiting',
  match_id     UUID,
  claim_token  UUID,
  enqueued_at  TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.now(),
  claimed_at   TIMESTAMPTZ,
  CONSTRAINT pvp_queue_status CHECK (status IN ('waiting', 'claimed', 'matched', 'left'))
);

CREATE INDEX IF NOT EXISTS pvp_queue_waiting_idx
  ON public.pvp_queue (rating, enqueued_at)
  WHERE status = 'waiting';

CREATE TABLE IF NOT EXISTS public.pvp_invites (
  code       TEXT PRIMARY KEY,
  host_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  deck       INTEGER[] NOT NULL,
  rating     INTEGER NOT NULL,
  display_name TEXT NOT NULL,
  kind       TEXT NOT NULL,
  rules      JSONB NOT NULL,
  gang_id    UUID,
  status     TEXT NOT NULL DEFAULT 'open',
  match_id   UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.now(),
  CONSTRAINT pvp_invites_kind CHECK (kind IN ('friend', 'gang')),
  CONSTRAINT pvp_invites_status CHECK (status IN ('open', 'filled', 'cancelled'))
);

CREATE TABLE IF NOT EXISTS public.pvp_slips (
  match_id   UUID PRIMARY KEY REFERENCES public.pvp_matches(id) ON DELETE CASCADE,
  username   TEXT NOT NULL,
  rival_name TEXT NOT NULL,
  won        BOOLEAN NOT NULL,
  tier       TEXT NOT NULL,
  taunt      SMALLINT
);

ALTER TABLE public.ladder_players
  ADD COLUMN IF NOT EXISTS pvp_rating INTEGER NOT NULL DEFAULT 1000,
  ADD COLUMN IF NOT EXISTS pvp_wins INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pvp_losses INTEGER NOT NULL DEFAULT 0;

ALTER TABLE public.gangs
  ADD COLUMN IF NOT EXISTS pvp_wins INTEGER NOT NULL DEFAULT 0;

ALTER TABLE public.pvp_matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pvp_players ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pvp_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pvp_views ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pvp_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pvp_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pvp_slips ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.pvp_matches FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.pvp_players FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.pvp_actions FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.pvp_views FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.pvp_queue FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.pvp_invites FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.pvp_slips FROM PUBLIC, anon, authenticated;

GRANT SELECT ON public.pvp_views TO authenticated;

CREATE POLICY pvp_views_own ON public.pvp_views
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Realtime delivers the projected row. Hidden columns are not in this table.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime')
     AND NOT EXISTS (
       SELECT 1 FROM pg_publication_tables
       WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'pvp_views'
     ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.pvp_views;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- Helpers. Service role only.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.pvp_window(p_at TIMESTAMPTZ)
RETURNS INTEGER
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
  SELECT LEAST(
    400,
    50 + 50 * pg_catalog.floor(
      EXTRACT(EPOCH FROM (pg_catalog.now() - p_at)) / 5.0
    )::integer
  );
$$;

CREATE OR REPLACE FUNCTION public.pvp_deck_ok(p_deck INTEGER[])
RETURNS BOOLEAN
LANGUAGE plpgsql
IMMUTABLE
SET search_path = ''
AS $$
DECLARE
  v_id INTEGER;
  v_n INTEGER;
BEGIN
  IF p_deck IS NULL OR pg_catalog.cardinality(p_deck) <> 10 THEN
    RETURN FALSE;
  END IF;
  FOREACH v_id IN ARRAY p_deck LOOP
    IF v_id IS NULL OR v_id < 1 OR v_id > 200 THEN
      RETURN FALSE;
    END IF;
    SELECT pg_catalog.count(*) INTO v_n FROM unnest(p_deck) AS u(id) WHERE u.id = v_id;
    IF v_n > 2 THEN
      RETURN FALSE;
    END IF;
  END LOOP;
  RETURN TRUE;
END;
$$;

CREATE OR REPLACE FUNCTION public.pvp_rate(p_uid UUID, p_action TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_max INTEGER;
  v_window INTEGER;
  v_start TIMESTAMPTZ;
  v_count INTEGER;
BEGIN
  IF p_uid IS NULL THEN
    RETURN FALSE;
  END IF;
  CASE p_action
    WHEN 'pvp_queue' THEN v_max := 30; v_window := 600;
    WHEN 'pvp_action' THEN v_max := 600; v_window := 60;
    WHEN 'pvp_invite' THEN v_max := 20; v_window := 600;
    ELSE RETURN FALSE;
  END CASE;

  SELECT window_start, request_count INTO v_start, v_count
  FROM public.rate_limits
  WHERE user_id = p_uid AND action_type = p_action
  FOR UPDATE;

  IF NOT FOUND THEN
    INSERT INTO public.rate_limits (user_id, action_type, window_start, request_count)
    VALUES (p_uid, p_action, pg_catalog.now(), 1)
    ON CONFLICT (user_id, action_type) DO UPDATE
      SET request_count = public.rate_limits.request_count + 1;
    RETURN TRUE;
  END IF;

  IF v_start < pg_catalog.now() - (v_window || ' seconds')::interval THEN
    UPDATE public.rate_limits
    SET window_start = pg_catalog.now(), request_count = 1
    WHERE user_id = p_uid AND action_type = p_action;
    RETURN TRUE;
  END IF;

  IF v_count >= v_max THEN
    RETURN FALSE;
  END IF;

  UPDATE public.rate_limits
  SET request_count = request_count + 1
  WHERE user_id = p_uid AND action_type = p_action;
  RETURN TRUE;
END;
$$;

CREATE OR REPLACE FUNCTION public.pvp_busy(p_uid UUID)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT m.id
  FROM public.pvp_players pl
  JOIN public.pvp_matches m ON m.id = pl.match_id
  WHERE pl.user_id = p_uid AND m.status = 'active'
  LIMIT 1;
$$;

-- Upsert a waiting row. Does not take the pairing lock.
CREATE OR REPLACE FUNCTION public.pvp_enqueue(
  p_uid UUID, p_deck INTEGER[], p_rating INTEGER, p_name TEXT
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_busy UUID;
  v_name TEXT;
BEGIN
  IF p_uid IS NULL THEN
    RETURN pg_catalog.jsonb_build_object('ok', false, 'error', 'auth');
  END IF;
  IF NOT public.pvp_deck_ok(p_deck) THEN
    RETURN pg_catalog.jsonb_build_object('ok', false, 'error', 'deck');
  END IF;
  IF NOT public.pvp_rate(p_uid, 'pvp_queue') THEN
    RETURN pg_catalog.jsonb_build_object('ok', false, 'error', 'slow');
  END IF;
  v_busy := public.pvp_busy(p_uid);
  IF v_busy IS NOT NULL THEN
    RETURN pg_catalog.jsonb_build_object('ok', true, 'status', 'active', 'match_id', v_busy);
  END IF;
  v_name := pg_catalog.left(pg_catalog.btrim(COALESCE(p_name, '')), 24);
  IF pg_catalog.length(v_name) < 2 THEN
    v_name := public.ladder_display_name(p_uid);
  END IF;

  INSERT INTO public.pvp_queue (user_id, deck, rating, display_name, status, match_id, claim_token, enqueued_at)
  VALUES (p_uid, p_deck, COALESCE(p_rating, 1000), v_name, 'waiting', NULL, NULL, pg_catalog.now())
  ON CONFLICT (user_id) DO UPDATE
    SET deck = EXCLUDED.deck,
        rating = EXCLUDED.rating,
        display_name = EXCLUDED.display_name,
        status = 'waiting',
        match_id = NULL,
        claim_token = NULL,
        enqueued_at = pg_catalog.now(),
        claimed_at = NULL
    WHERE public.pvp_queue.status IN ('waiting', 'left', 'matched');

  RETURN (
    SELECT pg_catalog.jsonb_build_object(
      'ok', true,
      'status', q.status,
      'match_id', q.match_id,
      'enqueued_at', q.enqueued_at
    )
    FROM public.pvp_queue q WHERE q.user_id = p_uid
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.pvp_leave_queue(p_uid UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  UPDATE public.pvp_queue
  SET status = 'left', claim_token = NULL
  WHERE user_id = p_uid AND status = 'waiting';
  RETURN pg_catalog.jsonb_build_object('ok', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.pvp_queue_row(p_uid UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_row public.pvp_queue%ROWTYPE;
  v_busy UUID;
BEGIN
  v_busy := public.pvp_busy(p_uid);
  IF v_busy IS NOT NULL THEN
    RETURN pg_catalog.jsonb_build_object('ok', true, 'status', 'active', 'match_id', v_busy);
  END IF;
  SELECT * INTO v_row FROM public.pvp_queue WHERE user_id = p_uid;
  IF NOT FOUND THEN
    RETURN pg_catalog.jsonb_build_object('ok', true, 'status', 'empty');
  END IF;
  RETURN pg_catalog.jsonb_build_object(
    'ok', true,
    'status', v_row.status,
    'match_id', v_row.match_id,
    'enqueued_at', v_row.enqueued_at,
    'rating', v_row.rating
  );
END;
$$;

-- Pair waiting players under a try-lock so a herd of joins does not queue on
-- one row. The caller that gets the lock pairs a batch. Everyone else returns
-- immediately and reads their own row.
CREATE OR REPLACE FUNCTION public.pvp_claim_pairs(p_limit INTEGER)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_limit INTEGER := LEAST(40, GREATEST(1, COALESCE(p_limit, 20)));
  v_a RECORD;
  v_b RECORD;
  v_ids UUID[] := ARRAY[]::UUID[];
  v_token UUID;
  v_out JSONB := '[]'::jsonb;
  v_window INTEGER;
BEGIN
  UPDATE public.pvp_queue
  SET status = 'waiting', claim_token = NULL, claimed_at = NULL
  WHERE status = 'claimed' AND claimed_at < pg_catalog.now() - INTERVAL '20 seconds';

  IF NOT pg_catalog.pg_try_advisory_xact_lock(4815162342) THEN
    RETURN v_out;
  END IF;

  FOR v_a IN
    SELECT * FROM public.pvp_queue
    WHERE status = 'waiting'
    ORDER BY enqueued_at
    FOR UPDATE
  LOOP
    IF v_a.user_id = ANY (v_ids) THEN
      CONTINUE;
    END IF;
    IF public.pvp_busy(v_a.user_id) IS NOT NULL THEN
      CONTINUE;
    END IF;
    v_window := public.pvp_window(v_a.enqueued_at);
    SELECT * INTO v_b
    FROM public.pvp_queue q
    WHERE q.status = 'waiting'
      AND q.user_id <> v_a.user_id
      AND NOT (q.user_id = ANY (v_ids))
      AND public.pvp_busy(q.user_id) IS NULL
      AND pg_catalog.abs(q.rating - v_a.rating) <= GREATEST(v_window, public.pvp_window(q.enqueued_at))
    ORDER BY pg_catalog.abs(q.rating - v_a.rating), q.enqueued_at
    LIMIT 1
    FOR UPDATE;
    IF NOT FOUND THEN
      CONTINUE;
    END IF;
    v_token := pg_catalog.gen_random_uuid();
    v_ids := v_ids || v_a.user_id || v_b.user_id;
    UPDATE public.pvp_queue
    SET status = 'claimed', claim_token = v_token, claimed_at = pg_catalog.now()
    WHERE user_id IN (v_a.user_id, v_b.user_id);
    v_out := v_out || pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object(
      'token', v_token,
      'a', pg_catalog.jsonb_build_object(
        'user_id', v_a.user_id, 'deck', v_a.deck, 'rating', v_a.rating, 'name', v_a.display_name,
        'enqueued_at', v_a.enqueued_at
      ),
      'b', pg_catalog.jsonb_build_object(
        'user_id', v_b.user_id, 'deck', v_b.deck, 'rating', v_b.rating, 'name', v_b.display_name,
        'enqueued_at', v_b.enqueued_at
      )
    ));
    IF pg_catalog.jsonb_array_length(v_out) >= v_limit THEN
      EXIT;
    END IF;
  END LOOP;
  RETURN v_out;
END;
$$;

CREATE OR REPLACE FUNCTION public.pvp_release_claim(p_token UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  UPDATE public.pvp_queue
  SET status = 'waiting', claim_token = NULL, claimed_at = NULL
  WHERE claim_token = p_token AND status = 'claimed';
END;
$$;

CREATE OR REPLACE FUNCTION public.pvp_open_match(p_body JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_token UUID := (p_body->>'token')::uuid;
  v_id UUID := COALESCE(NULLIF(p_body->>'id', '')::uuid, pg_catalog.gen_random_uuid());
  v_a UUID;
  v_b UUID;
  v_players JSONB;
  v_row JSONB;
  v_views JSONB;
BEGIN
  v_a := (p_body->'players'->0->>'user_id')::uuid;
  v_b := (p_body->'players'->1->>'user_id')::uuid;
  IF v_token IS NULL OR v_a IS NULL OR v_b IS NULL OR v_a = v_b THEN
    RETURN pg_catalog.jsonb_build_object('ok', false, 'error', 'bad');
  END IF;
  IF public.pvp_busy(v_a) IS NOT NULL OR public.pvp_busy(v_b) IS NOT NULL THEN
    PERFORM public.pvp_release_claim(v_token);
    RETURN pg_catalog.jsonb_build_object('ok', false, 'error', 'busy');
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.pvp_queue
    WHERE user_id = v_a AND status = 'claimed' AND claim_token = v_token
  ) OR NOT EXISTS (
    SELECT 1 FROM public.pvp_queue
    WHERE user_id = v_b AND status = 'claimed' AND claim_token = v_token
  ) THEN
    RETURN pg_catalog.jsonb_build_object('ok', false, 'error', 'claim');
  END IF;

  INSERT INTO public.pvp_matches (
    id, kind, status, version, seed, state, setup, rules, night, state_hash,
    deadline, gang_id
  ) VALUES (
    v_id,
    p_body->>'kind',
    'active',
    (p_body->'state'->>'version')::integer,
    (p_body->>'seed')::integer,
    p_body->'state',
    p_body->'setup',
    p_body->'rules',
    p_body->'night',
    p_body->>'hash',
    (p_body->>'deadline')::timestamptz,
    NULLIF(p_body->>'gang_id', '')::uuid
  );

  FOR v_row IN SELECT * FROM pg_catalog.jsonb_array_elements(p_body->'players') LOOP
    INSERT INTO public.pvp_players (match_id, user_id, seat, rating, display_name)
    VALUES (
      v_id,
      (v_row->>'user_id')::uuid,
      v_row->>'seat',
      (v_row->>'rating')::integer,
      v_row->>'name'
    );
  END LOOP;

  FOR v_views IN SELECT * FROM pg_catalog.jsonb_array_elements(p_body->'views') LOOP
    INSERT INTO public.pvp_views (match_id, user_id, version, payload)
    VALUES (
      v_id,
      (v_views->>'user_id')::uuid,
      (p_body->'state'->>'version')::integer,
      v_views->'payload'
    );
  END LOOP;

  UPDATE public.pvp_queue
  SET status = 'matched', match_id = v_id, claim_token = NULL
  WHERE claim_token = v_token;

  RETURN pg_catalog.jsonb_build_object('ok', true, 'match_id', v_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.pvp_load(p_match UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_match public.pvp_matches%ROWTYPE;
  v_players JSONB;
BEGIN
  SELECT * INTO v_match FROM public.pvp_matches WHERE id = p_match;
  IF NOT FOUND THEN
    RETURN pg_catalog.jsonb_build_object('ok', false, 'error', 'missing');
  END IF;
  SELECT pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
    'user_id', user_id, 'seat', seat, 'rating', rating, 'name', display_name,
    'last_seen', last_seen, 'connected', connected
  )) INTO v_players
  FROM public.pvp_players WHERE match_id = p_match;
  RETURN pg_catalog.jsonb_build_object(
    'ok', true,
    'id', v_match.id,
    'kind', v_match.kind,
    'status', v_match.status,
    'version', v_match.version,
    'seed', v_match.seed,
    'state', v_match.state,
    'setup', v_match.setup,
    'rules', v_match.rules,
    'night', v_match.night,
    'hash', v_match.state_hash,
    'winner_seat', v_match.winner_seat,
    'reason', v_match.finish_reason,
    'deadline', v_match.deadline,
    'grace_used', v_match.grace_used,
    'gang_id', v_match.gang_id,
    'result', v_match.result,
    'players', COALESCE(v_players, '[]'::jsonb)
  );
END;
$$;

-- Book the rating once, inside the commit that finishes the match.
CREATE OR REPLACE FUNCTION public.pvp_settle(p_match UUID, p_state JSONB, p_reason TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_winner_seat TEXT := p_state->>'winner';
  v_win UUID;
  v_lose UUID;
  v_win_rating INTEGER;
  v_lose_rating INTEGER;
  v_delta INTEGER;
  v_abandon INTEGER := 0;
  v_first UUID;
  v_second UUID;
  v_first_won BOOLEAN;
  v_applied_win INTEGER;
  v_applied_lose INTEGER;
  v_name TEXT;
  v_rival TEXT;
  v_taunt SMALLINT;
BEGIN
  IF v_winner_seat IS NULL THEN
    RETURN pg_catalog.jsonb_build_object('ok', true, 'skipped', true);
  END IF;
  SELECT user_id, display_name INTO v_win, v_name
  FROM public.pvp_players WHERE match_id = p_match AND seat = v_winner_seat;
  SELECT user_id, display_name INTO v_lose, v_rival
  FROM public.pvp_players WHERE match_id = p_match AND seat <> v_winner_seat;
  IF v_win IS NULL OR v_lose IS NULL THEN
    RETURN pg_catalog.jsonb_build_object('ok', false, 'error', 'players');
  END IF;

  PERFORM public.ladder_touch(v_win);
  PERFORM public.ladder_touch(v_lose);
  SELECT rating INTO v_win_rating FROM public.ladder_players WHERE user_id = v_win;
  SELECT rating INTO v_lose_rating FROM public.ladder_players WHERE user_id = v_lose;
  v_delta := public.ladder_delta(v_win_rating, v_lose_rating, TRUE);
  IF p_reason IN ('timeout', 'forfeit') THEN
    v_abandon := 10;
  END IF;

  -- Lock the two accounts in uuid order so two finishes cannot deadlock.
  IF v_win < v_lose THEN
    v_first := v_win; v_second := v_lose; v_first_won := TRUE;
  ELSE
    v_first := v_lose; v_second := v_win; v_first_won := FALSE;
  END IF;
  IF v_first_won THEN
    v_applied_win := public.ladder_grant(v_first, v_delta, TRUE);
    v_applied_lose := public.ladder_grant(v_second, -v_delta, FALSE);
  ELSE
    v_applied_lose := public.ladder_grant(v_first, -v_delta, FALSE);
    v_applied_win := public.ladder_grant(v_second, v_delta, TRUE);
  END IF;

  IF v_abandon > 0 THEN
    UPDATE public.ladder_players
    SET rating = GREATEST(100, rating - v_abandon)
    WHERE user_id = v_lose;
    v_applied_lose := v_applied_lose - v_abandon;
  END IF;

  UPDATE public.ladder_players
  SET pvp_rating = LEAST(2400, GREATEST(100, pvp_rating + v_applied_win)),
      pvp_wins = pvp_wins + 1
  WHERE user_id = v_win;
  UPDATE public.ladder_players
  SET pvp_rating = LEAST(2400, GREATEST(100, pvp_rating + v_applied_lose)),
      pvp_losses = pvp_losses + 1
  WHERE user_id = v_lose;

  UPDATE public.gangs g
  SET pvp_wins = g.pvp_wins + 1
  FROM public.gang_members m
  WHERE m.user_id = v_win AND m.gang_id = g.id;

  v_taunt := NULLIF(p_state->'seats'->v_winner_seat->>'taunt', '')::smallint;
  INSERT INTO public.pvp_slips (match_id, username, rival_name, won, tier, taunt)
  VALUES (p_match, v_name, v_rival, TRUE, public.ladder_tier(v_win_rating + v_applied_win), v_taunt)
  ON CONFLICT (match_id) DO NOTHING;

  RETURN pg_catalog.jsonb_build_object(
    'ok', true,
    'winner_delta', v_applied_win,
    'loser_delta', v_applied_lose,
    'winner_id', v_win,
    'loser_id', v_lose
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.pvp_commit(p_body JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_id UUID := (p_body->>'match_id')::uuid;
  v_user UUID := (p_body->>'user_id')::uuid;
  v_action UUID := (p_body->>'action_id')::uuid;
  v_expected INTEGER := (p_body->>'expected')::integer;
  v_match public.pvp_matches%ROWTYPE;
  v_seat TEXT;
  v_view JSONB;
  v_settled JSONB := NULL;
BEGIN
  SELECT * INTO v_match FROM public.pvp_matches WHERE id = v_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN pg_catalog.jsonb_build_object('ok', false, 'error', 'missing');
  END IF;
  SELECT seat INTO v_seat FROM public.pvp_players WHERE match_id = v_id AND user_id = v_user;
  IF v_seat IS NULL THEN
    RETURN pg_catalog.jsonb_build_object('ok', false, 'error', 'player');
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.pvp_actions WHERE match_id = v_id AND action_id = v_action
  ) THEN
    RETURN pg_catalog.jsonb_build_object('ok', true, 'idempotent', true, 'version', v_match.version);
  END IF;

  IF v_match.status <> 'active' THEN
    RETURN pg_catalog.jsonb_build_object('ok', false, 'error', 'closed', 'version', v_match.version);
  END IF;
  IF v_match.version <> v_expected THEN
    RETURN pg_catalog.jsonb_build_object('ok', false, 'error', 'stale', 'version', v_match.version);
  END IF;

  UPDATE public.pvp_matches SET
    state = p_body->'state',
    version = v_expected + 1,
    state_hash = p_body->>'hash',
    status = p_body->>'status',
    winner_seat = NULLIF(p_body->>'winner_seat', ''),
    finish_reason = NULLIF(p_body->>'reason', ''),
    deadline = NULLIF(p_body->>'deadline', '')::timestamptz,
    grace_used = COALESCE((p_body->>'grace_used')::boolean, grace_used),
    finished_at = CASE WHEN p_body->>'status' = 'finished' THEN pg_catalog.now() ELSE finished_at END
  WHERE id = v_id;

  INSERT INTO public.pvp_actions (match_id, action_id, user_id, turn_number, version, intent)
  VALUES (
    v_id, v_action, v_user,
    COALESCE((p_body->>'turn')::integer, 0),
    v_expected,
    p_body->'intent'
  );

  UPDATE public.pvp_players
  SET last_seen = pg_catalog.now(), connected = TRUE
  WHERE match_id = v_id AND user_id = v_user;

  FOR v_view IN SELECT * FROM pg_catalog.jsonb_array_elements(p_body->'views') LOOP
    INSERT INTO public.pvp_views (match_id, user_id, version, payload, updated_at)
    VALUES (
      v_id,
      (v_view->>'user_id')::uuid,
      v_expected + 1,
      v_view->'payload',
      pg_catalog.now()
    )
    ON CONFLICT (match_id, user_id) DO UPDATE
      SET version = EXCLUDED.version,
          payload = EXCLUDED.payload,
          updated_at = EXCLUDED.updated_at;
  END LOOP;

  IF p_body->>'status' = 'finished' THEN
    v_settled := public.pvp_settle(v_id, p_body->'state', p_body->>'reason');
    UPDATE public.pvp_matches SET result = v_settled WHERE id = v_id;
  END IF;

  RETURN pg_catalog.jsonb_build_object(
    'ok', true, 'version', v_expected + 1, 'settled', v_settled
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.pvp_presence(
  p_match UUID, p_user UUID, p_expected INTEGER, p_grace BOOLEAN, p_deadline TIMESTAMPTZ
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_n INTEGER;
BEGIN
  UPDATE public.pvp_players
  SET last_seen = pg_catalog.now(), connected = TRUE
  WHERE match_id = p_match AND user_id = p_user;
  UPDATE public.pvp_matches
  SET grace_used = p_grace, deadline = p_deadline
  WHERE id = p_match AND version = p_expected AND status = 'active';
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RETURN pg_catalog.jsonb_build_object('ok', true, 'extended', v_n > 0);
END;
$$;

CREATE OR REPLACE FUNCTION public.pvp_due(p_limit INTEGER)
RETURNS UUID[]
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_ids UUID[] := ARRAY[]::UUID[];
  v_id UUID;
BEGIN
  FOR v_id IN
    SELECT id FROM public.pvp_matches
    WHERE status = 'active' AND deadline IS NOT NULL AND deadline <= pg_catalog.now()
    ORDER BY deadline
    LIMIT LEAST(200, GREATEST(1, COALESCE(p_limit, 50)))
    FOR UPDATE SKIP LOCKED
  LOOP
    v_ids := v_ids || v_id;
  END LOOP;
  RETURN v_ids;
END;
$$;

CREATE OR REPLACE FUNCTION public.pvp_rating_of(p_uid UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RETURN public.ladder_touch(p_uid);
END;
$$;

CREATE OR REPLACE FUNCTION public.pvp_save_of(p_uid UUID)
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT save FROM public.player_saves WHERE user_id = p_uid;
$$;

CREATE OR REPLACE FUNCTION public.pvp_gang_of(p_uid UUID)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT gang_id FROM public.gang_members WHERE user_id = p_uid;
$$;

CREATE OR REPLACE FUNCTION public.pvp_invite_create(p_body JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid UUID := (p_body->>'user_id')::uuid;
  v_code TEXT;
  v_gang UUID;
  v_kind TEXT := p_body->>'kind';
BEGIN
  IF NOT public.pvp_deck_ok(
    ARRAY(SELECT jsonb_array_elements_text(p_body->'deck')::integer)
  ) THEN
    RETURN pg_catalog.jsonb_build_object('ok', false, 'error', 'deck');
  END IF;
  IF NOT public.pvp_rate(v_uid, 'pvp_invite') THEN
    RETURN pg_catalog.jsonb_build_object('ok', false, 'error', 'slow');
  END IF;
  IF v_kind = 'gang' THEN
    v_gang := public.pvp_gang_of(v_uid);
    IF v_gang IS NULL THEN
      RETURN pg_catalog.jsonb_build_object('ok', false, 'error', 'gang');
    END IF;
  END IF;
  v_code := pg_catalog.substr(pg_catalog.replace(pg_catalog.gen_random_uuid()::text, '-', ''), 1, 10);
  INSERT INTO public.pvp_invites (code, host_id, deck, rating, display_name, kind, rules, gang_id)
  VALUES (
    v_code, v_uid,
    ARRAY(SELECT jsonb_array_elements_text(p_body->'deck')::integer),
    COALESCE((p_body->>'rating')::integer, 1000),
    COALESCE(NULLIF(p_body->>'name', ''), public.ladder_display_name(v_uid)),
    v_kind,
    COALESCE(p_body->'rules', '{"id":"standard","hp":0,"energy":0,"damage":0}'::jsonb),
    v_gang
  );
  RETURN pg_catalog.jsonb_build_object('ok', true, 'code', v_code, 'kind', v_kind);
END;
$$;

CREATE OR REPLACE FUNCTION public.pvp_invite_get(p_code TEXT)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_row public.pvp_invites%ROWTYPE;
BEGIN
  SELECT * INTO v_row FROM public.pvp_invites WHERE code = pg_catalog.lower(pg_catalog.btrim(COALESCE(p_code, '')));
  IF NOT FOUND OR v_row.status <> 'open' THEN
    RETURN pg_catalog.jsonb_build_object('ok', false, 'error', 'missing');
  END IF;
  RETURN pg_catalog.jsonb_build_object(
    'ok', true,
    'code', v_row.code,
    'host_id', v_row.host_id,
    'deck', v_row.deck,
    'rating', v_row.rating,
    'name', v_row.display_name,
    'kind', v_row.kind,
    'rules', v_row.rules,
    'gang_id', v_row.gang_id
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.pvp_invite_fill(p_code TEXT, p_match UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  UPDATE public.pvp_invites
  SET status = 'filled', match_id = p_match
  WHERE code = p_code AND status = 'open';
  IF NOT FOUND THEN
    RETURN pg_catalog.jsonb_build_object('ok', false, 'error', 'missing');
  END IF;
  RETURN pg_catalog.jsonb_build_object('ok', true);
END;
$$;

-- Direct open for a friend or gang invite. No queue claim. Both seats are
-- inserted here; the edge function has already built the state.
CREATE OR REPLACE FUNCTION public.pvp_open_direct(p_body JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_id UUID := COALESCE(NULLIF(p_body->>'id', '')::uuid, pg_catalog.gen_random_uuid());
  v_a UUID := (p_body->'players'->0->>'user_id')::uuid;
  v_b UUID := (p_body->'players'->1->>'user_id')::uuid;
  v_row JSONB;
  v_views JSONB;
BEGIN
  IF v_a IS NULL OR v_b IS NULL OR v_a = v_b THEN
    RETURN pg_catalog.jsonb_build_object('ok', false, 'error', 'bad');
  END IF;
  IF public.pvp_busy(v_a) IS NOT NULL OR public.pvp_busy(v_b) IS NOT NULL THEN
    RETURN pg_catalog.jsonb_build_object('ok', false, 'error', 'busy');
  END IF;
  INSERT INTO public.pvp_matches (
    id, kind, status, version, seed, state, setup, rules, night, state_hash, deadline, gang_id, invite_code
  ) VALUES (
    v_id, p_body->>'kind', 'active',
    (p_body->'state'->>'version')::integer,
    (p_body->>'seed')::integer,
    p_body->'state', p_body->'setup', p_body->'rules', p_body->'night',
    p_body->>'hash',
    (p_body->>'deadline')::timestamptz,
    NULLIF(p_body->>'gang_id', '')::uuid,
    NULLIF(p_body->>'invite_code', '')
  );
  FOR v_row IN SELECT * FROM pg_catalog.jsonb_array_elements(p_body->'players') LOOP
    INSERT INTO public.pvp_players (match_id, user_id, seat, rating, display_name)
    VALUES (v_id, (v_row->>'user_id')::uuid, v_row->>'seat', (v_row->>'rating')::integer, v_row->>'name');
  END LOOP;
  FOR v_views IN SELECT * FROM pg_catalog.jsonb_array_elements(p_body->'views') LOOP
    INSERT INTO public.pvp_views (match_id, user_id, version, payload)
    VALUES (v_id, (v_views->>'user_id')::uuid, (p_body->'state'->>'version')::integer, v_views->'payload');
  END LOOP;
  RETURN pg_catalog.jsonb_build_object('ok', true, 'match_id', v_id);
END;
$$;

-- Public slip. Same shape as the ghost slip, and still no deck.
CREATE OR REPLACE FUNCTION public.slip_preview(p_id UUID)
RETURNS TABLE (
  username TEXT,
  rival_name TEXT,
  won BOOLEAN,
  tier TEXT,
  taunt SMALLINT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF p_id IS NULL THEN RETURN; END IF;
  RETURN QUERY
  SELECT
    public.ladder_display_name(m.challenger_id),
    m.rival_name,
    m.won,
    public.ladder_tier(m.challenger_rating),
    m.taunt
  FROM public.ladder_matches m
  WHERE m.id = p_id AND m.status = 'reported';
  IF FOUND THEN RETURN; END IF;
  RETURN QUERY
  SELECT s.username, s.rival_name, s.won, s.tier, s.taunt
  FROM public.pvp_slips s
  WHERE s.match_id = p_id;
END;
$$;

DROP FUNCTION IF EXISTS public.gang_board();

CREATE FUNCTION public.gang_board()
RETURNS TABLE (
  place BIGINT,
  tag TEXT,
  name TEXT,
  members INTEGER,
  rating INTEGER,
  pvp_wins INTEGER
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_season TEXT := public.ladder_season_id(pg_catalog.now());
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not signed in' USING ERRCODE = 'PT401'; END IF;
  RETURN QUERY
  SELECT
    pg_catalog.rank() OVER (ORDER BY shown.rating DESC, shown.tag),
    shown.tag,
    shown.name,
    shown.members,
    shown.rating,
    shown.pvp_wins
  FROM (
    SELECT
      g.tag,
      g.name,
      pg_catalog.count(m.user_id)::INTEGER AS members,
      COALESCE(pg_catalog.sum(
        CASE WHEN l.season_id = v_season THEN l.rating ELSE public.ladder_soft(l.rating) END
      ), 0)::INTEGER AS rating,
      g.pvp_wins
    FROM public.gangs g
    JOIN public.gang_members m ON m.gang_id = g.id
    LEFT JOIN public.ladder_players l ON l.user_id = m.user_id
    GROUP BY g.id, g.tag, g.name, g.pvp_wins
  ) shown
  ORDER BY shown.rating DESC, shown.tag
  LIMIT 30;
END;
$$;

REVOKE ALL ON FUNCTION public.pvp_window(TIMESTAMPTZ) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.pvp_deck_ok(INTEGER[]) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.pvp_rate(UUID, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.pvp_busy(UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.pvp_enqueue(UUID, INTEGER[], INTEGER, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.pvp_leave_queue(UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.pvp_queue_row(UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.pvp_claim_pairs(INTEGER) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.pvp_release_claim(UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.pvp_open_match(JSONB) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.pvp_load(UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.pvp_settle(UUID, JSONB, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.pvp_commit(JSONB) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.pvp_presence(UUID, UUID, INTEGER, BOOLEAN, TIMESTAMPTZ) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.pvp_due(INTEGER) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.pvp_rating_of(UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.pvp_save_of(UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.pvp_gang_of(UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.pvp_invite_create(JSONB) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.pvp_invite_get(TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.pvp_invite_fill(TEXT, UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.pvp_open_direct(JSONB) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.pvp_window(TIMESTAMPTZ) TO service_role;
GRANT EXECUTE ON FUNCTION public.pvp_deck_ok(INTEGER[]) TO service_role;
GRANT EXECUTE ON FUNCTION public.pvp_rate(UUID, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.pvp_busy(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.pvp_enqueue(UUID, INTEGER[], INTEGER, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.pvp_leave_queue(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.pvp_queue_row(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.pvp_claim_pairs(INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION public.pvp_release_claim(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.pvp_open_match(JSONB) TO service_role;
GRANT EXECUTE ON FUNCTION public.pvp_load(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.pvp_settle(UUID, JSONB, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.pvp_commit(JSONB) TO service_role;
GRANT EXECUTE ON FUNCTION public.pvp_presence(UUID, UUID, INTEGER, BOOLEAN, TIMESTAMPTZ) TO service_role;
GRANT EXECUTE ON FUNCTION public.pvp_due(INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION public.pvp_rating_of(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.pvp_save_of(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.pvp_gang_of(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.pvp_invite_create(JSONB) TO service_role;
GRANT EXECUTE ON FUNCTION public.pvp_invite_get(TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.pvp_invite_fill(TEXT, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.pvp_open_direct(JSONB) TO service_role;

GRANT EXECUTE ON FUNCTION public.ladder_touch(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.ladder_grant(UUID, INTEGER, BOOLEAN) TO service_role;
GRANT EXECUTE ON FUNCTION public.ladder_delta(INTEGER, INTEGER, BOOLEAN) TO service_role;
GRANT EXECUTE ON FUNCTION public.ladder_tier(INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION public.ladder_display_name(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.ladder_soft(INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION public.ladder_season_id(TIMESTAMPTZ) TO service_role;

REVOKE ALL ON FUNCTION public.gang_board() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.gang_board() TO authenticated;

REVOKE ALL ON FUNCTION public.slip_preview(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.slip_preview(UUID) TO anon, authenticated;
