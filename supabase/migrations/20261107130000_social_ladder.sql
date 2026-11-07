-- Social ladder: a competitive rating, saved ghost decks, and friend challenges.
-- Idempotent. One transaction, as `supabase db push` applies each file.
--
-- The all-time trophy board stays what it is (lifetime wins and level). This
-- is a separate book. A client can ask for a ticket and can attest one
-- result on a ticket this server issued. It cannot send a rating, a delta,
-- or a user id. The rating change is computed here, clamped, rate-limited,
-- and applied to both players. Tables are not writable by client roles.
--
-- Shared links read challenge_preview, which returns a name, a tier and a
-- rating. No deck, no user id, no account column.

-- ---------------------------------------------------------------------------
-- Tables. RLS on, and no client grants: security-definer functions are the
-- only door. A policy without a revoke would still let PostgREST through.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.ladder_players (
  user_id      UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  rating       INTEGER NOT NULL DEFAULT 1000,
  peak_rating  INTEGER NOT NULL DEFAULT 1000,
  season_id    TEXT NOT NULL,
  week_wins    INTEGER NOT NULL DEFAULT 0,
  week_losses  INTEGER NOT NULL DEFAULT 0,
  week_delta   INTEGER NOT NULL DEFAULT 0,
  day_gain     INTEGER NOT NULL DEFAULT 0,
  day_loss     INTEGER NOT NULL DEFAULT 0,
  day_key      DATE NOT NULL,
  wins         INTEGER NOT NULL DEFAULT 0,
  losses       INTEGER NOT NULL DEFAULT 0,
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.now()
);

CREATE TABLE IF NOT EXISTS public.ghost_decks (
  user_id    UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  code       TEXT NOT NULL UNIQUE,
  deck       INTEGER[] NOT NULL,
  label      TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.now()
);

CREATE TABLE IF NOT EXISTS public.ladder_matches (
  id                 UUID PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
  challenger_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  ghost_id           UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind               TEXT NOT NULL,
  deck               INTEGER[] NOT NULL,
  rival_name         TEXT NOT NULL,
  label              TEXT NOT NULL,
  challenger_rating  INTEGER NOT NULL,
  ghost_rating       INTEGER NOT NULL,
  season_id          TEXT NOT NULL,
  status             TEXT NOT NULL DEFAULT 'open',
  won                BOOLEAN,
  delta              INTEGER,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.now(),
  reported_at        TIMESTAMPTZ,
  CONSTRAINT ladder_matches_not_self CHECK (challenger_id <> ghost_id),
  CONSTRAINT ladder_matches_kind CHECK (kind IN ('queue', 'challenge')),
  CONSTRAINT ladder_matches_status CHECK (status IN ('open', 'reported', 'expired'))
);

CREATE UNIQUE INDEX IF NOT EXISTS ladder_one_open_match
  ON public.ladder_matches (challenger_id) WHERE status = 'open';

CREATE INDEX IF NOT EXISTS ladder_players_rating_idx
  ON public.ladder_players (rating DESC);

ALTER TABLE public.ladder_players ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ghost_decks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ladder_matches ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.ladder_players FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.ghost_decks FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.ladder_matches FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Pure helpers. Invoker, empty search_path, no client grant. The numbers are
-- the same ones src/lib/social/ladder.js uses; check-migrations.sh pins both.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.ladder_season_id(p_at TIMESTAMPTZ)
RETURNS TEXT
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
  SELECT pg_catalog.to_char(pg_catalog.timezone('utc', p_at), 'IYYY')
      || '-W'
      || pg_catalog.to_char(pg_catalog.timezone('utc', p_at), 'IW');
$$;

-- Halfway back to 1000, the Monday soft reset. Integer division, then clamp.
CREATE OR REPLACE FUNCTION public.ladder_soft(p_rating INTEGER)
RETURNS INTEGER
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT LEAST(2400, GREATEST(100, 1000 + (COALESCE(p_rating, 1000) - 1000) / 2));
$$;

CREATE OR REPLACE FUNCTION public.ladder_tier(p_rating INTEGER)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT CASE
    WHEN COALESCE(p_rating, 0) >= 2000 THEN 'All Night'
    WHEN p_rating >= 1800 THEN 'Last Call'
    WHEN p_rating >= 1650 THEN 'After Hours'
    WHEN p_rating >= 1500 THEN 'Back Booth'
    WHEN p_rating >= 1350 THEN 'Easy'
    WHEN p_rating >= 1200 THEN 'Regular'
    WHEN p_rating >= 1050 THEN 'Getting Handsy'
    ELSE 'Warming Up'
  END;
$$;

-- Elo, K = 24, clamped to ±32. Round half away from zero via numeric round.
CREATE OR REPLACE FUNCTION public.ladder_delta(p_own INTEGER, p_other INTEGER, p_won BOOLEAN)
RETURNS INTEGER
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT LEAST(32, GREATEST(-32, pg_catalog.round(
    24 * (
      (CASE WHEN p_won THEN 1 ELSE 0 END)::numeric
      - (1.0 / (1.0 + pg_catalog.power(10::numeric, (COALESCE(p_other, 1000) - COALESCE(p_own, 1000))::numeric / 400)))
    )
  )::integer));
$$;

-- ---------------------------------------------------------------------------
-- Rate limit for the social actions only. Same shape as check_rate_limit:
-- the window and the user come from the server, unknown actions are rejected,
-- and the row is keyed on auth.uid(). Not granted to clients; the public
-- functions below spend it themselves.
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

-- Ensure a ladder row, roll the week and the day, return the rating now.
-- Locks the row. Callers lock the two players in uuid order.
CREATE OR REPLACE FUNCTION public.ladder_touch(p_uid UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_season TEXT := public.ladder_season_id(pg_catalog.now());
  v_day    DATE := (pg_catalog.timezone('utc', pg_catalog.now()))::date;
  v_row    public.ladder_players%ROWTYPE;
  v_rating INTEGER;
BEGIN
  INSERT INTO public.ladder_players (user_id, rating, peak_rating, season_id, day_key)
  VALUES (p_uid, 1000, 1000, v_season, v_day)
  ON CONFLICT (user_id) DO NOTHING;

  SELECT * INTO v_row FROM public.ladder_players WHERE user_id = p_uid FOR UPDATE;
  v_rating := v_row.rating;

  IF v_row.season_id IS DISTINCT FROM v_season THEN
    v_rating := public.ladder_soft(v_row.rating);
    UPDATE public.ladder_players SET
      rating = v_rating,
      season_id = v_season,
      week_wins = 0,
      week_losses = 0,
      week_delta = 0,
      day_gain = 0,
      day_loss = 0,
      day_key = v_day,
      updated_at = pg_catalog.now()
    WHERE user_id = p_uid;
  ELSIF v_row.day_key IS DISTINCT FROM v_day THEN
    UPDATE public.ladder_players SET
      day_gain = 0,
      day_loss = 0,
      day_key = v_day,
      updated_at = pg_catalog.now()
    WHERE user_id = p_uid;
  END IF;

  RETURN v_rating;
END;
$$;

-- Apply one side of a result. p_delta is the unclamped Elo step. Gains and
-- losses are each capped at 80 rating a day, so a forged streak and a pile-on
-- both run out of road. The win or the loss is counted either way.
CREATE OR REPLACE FUNCTION public.ladder_grant(p_uid UUID, p_delta INTEGER, p_won BOOLEAN)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_row      public.ladder_players%ROWTYPE;
  v_applied  INTEGER := COALESCE(p_delta, 0);
  v_room     INTEGER;
  v_rating   INTEGER;
BEGIN
  PERFORM public.ladder_touch(p_uid);
  SELECT * INTO v_row FROM public.ladder_players WHERE user_id = p_uid FOR UPDATE;

  IF v_applied > 32 THEN v_applied := 32; END IF;
  IF v_applied < -32 THEN v_applied := -32; END IF;

  IF v_applied > 0 THEN
    v_room := GREATEST(0, 80 - v_row.day_gain);
    IF v_applied > v_room THEN v_applied := v_room; END IF;
  ELSIF v_applied < 0 THEN
    v_room := GREATEST(0, 80 - v_row.day_loss);
    IF -v_applied > v_room THEN v_applied := -v_room; END IF;
  END IF;

  v_rating := LEAST(2400, GREATEST(100, v_row.rating + v_applied));
  -- The clamp at the floor or the ceiling can shrink what actually landed.
  v_applied := v_rating - v_row.rating;

  UPDATE public.ladder_players SET
    rating = v_rating,
    peak_rating = GREATEST(peak_rating, v_rating),
    week_wins = week_wins + (CASE WHEN p_won THEN 1 ELSE 0 END),
    week_losses = week_losses + (CASE WHEN p_won THEN 0 ELSE 1 END),
    week_delta = week_delta + v_applied,
    wins = wins + (CASE WHEN p_won THEN 1 ELSE 0 END),
    losses = losses + (CASE WHEN p_won THEN 0 ELSE 1 END),
    day_gain = day_gain + (CASE WHEN v_applied > 0 THEN v_applied ELSE 0 END),
    day_loss = day_loss + (CASE WHEN v_applied < 0 THEN -v_applied ELSE 0 END),
    updated_at = pg_catalog.now()
  WHERE user_id = p_uid;

  RETURN v_applied;
END;
$$;

CREATE OR REPLACE FUNCTION public.ladder_receipt(p_match_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_match public.ladder_matches%ROWTYPE;
  v_row   public.ladder_players%ROWTYPE;
BEGIN
  SELECT * INTO v_match FROM public.ladder_matches WHERE id = p_match_id;
  IF NOT FOUND THEN
    RETURN pg_catalog.jsonb_build_object('ok', false, 'reason', 'missing');
  END IF;
  SELECT * INTO v_row FROM public.ladder_players WHERE user_id = v_match.challenger_id;
  RETURN pg_catalog.jsonb_build_object(
    'ok', true,
    'won', v_match.won,
    'delta', COALESCE(v_match.delta, 0),
    'rating', COALESCE(v_row.rating, 1000),
    'peak_rating', COALESCE(v_row.peak_rating, 1000),
    'tier', public.ladder_tier(COALESCE(v_row.rating, 1000)),
    'rival_name', v_match.rival_name,
    'week_wins', COALESCE(v_row.week_wins, 0),
    'week_losses', COALESCE(v_row.week_losses, 0),
    'week_delta', COALESCE(v_row.week_delta, 0),
    'wins', COALESCE(v_row.wins, 0),
    'losses', COALESCE(v_row.losses, 0),
    'season_id', COALESCE(v_row.season_id, public.ladder_season_id(pg_catalog.now()))
  );
END;
$$;

-- A ticket the client can deal. The deck is the snapshot on the match.
CREATE OR REPLACE FUNCTION public.ladder_ticket(p_match public.ladder_matches)
RETURNS JSONB
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
  SELECT pg_catalog.jsonb_build_object(
    'ok', true,
    'match_id', p_match.id,
    'rival_name', p_match.rival_name,
    'label', p_match.label,
    'deck', pg_catalog.to_jsonb(p_match.deck),
    'rival_rating', p_match.ghost_rating,
    'your_rating', p_match.challenger_rating,
    'kind', p_match.kind
  );
$$;

CREATE OR REPLACE FUNCTION public.ladder_display_name(p_uid UUID)
RETURNS TEXT
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
  SELECT COALESCE(
    (SELECT username FROM public.players WHERE user_id = p_uid),
    'Player_' || pg_catalog.left(p_uid::text, 8)
  );
$$;

-- ---------------------------------------------------------------------------
-- The calls a signed-in player makes. Every one takes the account from
-- auth.uid(). None of them take a rating.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.my_social()
RETURNS JSONB
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid   UUID := auth.uid();
  v_row   public.ladder_players%ROWTYPE;
  v_code  TEXT;
  v_label TEXT;
  v_open  public.ladder_matches%ROWTYPE;
  v_day   DATE := (pg_catalog.timezone('utc', pg_catalog.now()))::date;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not signed in' USING ERRCODE = 'PT401';
  END IF;

  PERFORM public.ladder_touch(v_uid);
  SELECT * INTO v_row FROM public.ladder_players WHERE user_id = v_uid;
  SELECT code, label INTO v_code, v_label FROM public.ghost_decks WHERE user_id = v_uid;
  SELECT * INTO v_open FROM public.ladder_matches
  WHERE challenger_id = v_uid AND status = 'open'
  ORDER BY created_at DESC
  LIMIT 1;

  RETURN pg_catalog.jsonb_build_object(
    'ok', true,
    'username', public.ladder_display_name(v_uid),
    'rating', v_row.rating,
    'peak_rating', v_row.peak_rating,
    'tier', public.ladder_tier(v_row.rating),
    'wins', v_row.wins,
    'losses', v_row.losses,
    'week_wins', v_row.week_wins,
    'week_losses', v_row.week_losses,
    'week_delta', v_row.week_delta,
    'season_id', v_row.season_id,
    'day_room', GREATEST(0, 80 - CASE WHEN v_row.day_key = v_day THEN v_row.day_gain ELSE 0 END),
    'code', v_code,
    'label', v_label,
    'open_match', CASE WHEN v_open.id IS NULL THEN NULL ELSE public.ladder_ticket(v_open) END
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.publish_ghost(p_deck INTEGER[], p_label TEXT)
RETURNS JSONB
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid   UUID := auth.uid();
  v_label TEXT := pg_catalog.btrim(COALESCE(p_label, ''::text));
  v_code  TEXT;
  v_try   INTEGER := 0;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not signed in' USING ERRCODE = 'PT401';
  END IF;

  IF p_deck IS NULL OR pg_catalog.cardinality(p_deck) <> 10 THEN
    RAISE EXCEPTION 'Deck must be 10 cards' USING ERRCODE = '22023';
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_catalog.unnest(p_deck) AS d(card_id)
    WHERE d.card_id IS NULL OR d.card_id < 1 OR d.card_id > 200
  ) THEN
    RAISE EXCEPTION 'Deck must be 10 real cards' USING ERRCODE = '22023';
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_catalog.unnest(p_deck) AS d(card_id)
    GROUP BY d.card_id
    HAVING pg_catalog.count(*) > 2
  ) THEN
    RAISE EXCEPTION 'Two copies of a card is the house limit' USING ERRCODE = '22023';
  END IF;

  IF NOT public.social_rate_limit('social_publish') THEN
    RETURN pg_catalog.jsonb_build_object('ok', false, 'reason', 'slow');
  END IF;

  IF pg_catalog.char_length(v_label) < 2
     OR pg_catalog.char_length(v_label) > 24
     OR v_label !~ '^[A-Za-z0-9 _.!?-]+$' THEN
    v_label := 'Saved deck';
  END IF;

  PERFORM public.ladder_touch(v_uid);

  SELECT code INTO v_code FROM public.ghost_decks WHERE user_id = v_uid FOR UPDATE;
  IF v_code IS NOT NULL THEN
    UPDATE public.ghost_decks
    SET deck = p_deck, label = v_label, updated_at = pg_catalog.now()
    WHERE user_id = v_uid;
  ELSE
    WHILE v_try < 5 AND v_code IS NULL LOOP
      v_try := v_try + 1;
      v_code := pg_catalog.substr(pg_catalog.md5(pg_catalog.gen_random_uuid()::text), 1, 10);
      BEGIN
        INSERT INTO public.ghost_decks (user_id, code, deck, label)
        VALUES (v_uid, v_code, p_deck, v_label);
      EXCEPTION WHEN unique_violation THEN
        -- The code collided, or a concurrent publish won the user_id.
        UPDATE public.ghost_decks
        SET deck = p_deck, label = v_label, updated_at = pg_catalog.now()
        WHERE user_id = v_uid
        RETURNING code INTO v_code;
      END;
    END LOOP;
    IF v_code IS NULL THEN
      RAISE EXCEPTION 'Could not publish that deck' USING ERRCODE = '23505';
    END IF;
  END IF;

  RETURN pg_catalog.jsonb_build_object('ok', true, 'code', v_code, 'label', v_label);
END;
$$;

-- Issue a ticket against one saved deck. p_kind is queue or challenge.
-- One open ticket at a time. Queue pairs stop at 3 reported fights a season;
-- a challenge link stops at 8 a day. The deck on the ticket is a copy.
CREATE OR REPLACE FUNCTION public.ladder_issue(p_ghost UUID, p_kind TEXT)
RETURNS JSONB
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid    UUID := auth.uid();
  v_ghost  public.ghost_decks%ROWTYPE;
  v_open   public.ladder_matches%ROWTYPE;
  v_season TEXT;
  v_my     INTEGER;
  v_their  INTEGER;
  v_n      INTEGER;
  v_match  public.ladder_matches%ROWTYPE;
  v_low    UUID;
  v_high   UUID;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not signed in' USING ERRCODE = 'PT401';
  END IF;
  IF p_ghost IS NULL OR p_ghost = v_uid THEN
    RETURN pg_catalog.jsonb_build_object('ok', false, 'reason', 'self');
  END IF;
  IF p_kind NOT IN ('queue', 'challenge') THEN
    RETURN pg_catalog.jsonb_build_object('ok', false, 'reason', 'missing');
  END IF;

  -- A ticket that has sat for 45 minutes is over. Free the one-open slot.
  UPDATE public.ladder_matches
  SET status = 'expired'
  WHERE challenger_id = v_uid
    AND status = 'open'
    AND created_at <= pg_catalog.now() - INTERVAL '45 minutes';

  SELECT * INTO v_open FROM public.ladder_matches
  WHERE challenger_id = v_uid AND status = 'open'
  LIMIT 1;
  IF v_open.id IS NOT NULL THEN
    RETURN public.ladder_ticket(v_open) || pg_catalog.jsonb_build_object('reason', 'open');
  END IF;

  SELECT * INTO v_ghost FROM public.ghost_decks WHERE user_id = p_ghost;
  IF NOT FOUND THEN
    RETURN pg_catalog.jsonb_build_object('ok', false, 'reason', 'missing');
  END IF;

  v_season := public.ladder_season_id(pg_catalog.now());
  IF p_kind = 'queue' THEN
    SELECT pg_catalog.count(*) INTO v_n FROM public.ladder_matches
    WHERE status = 'reported'
      AND season_id = v_season
      AND kind = 'queue'
      AND (
        (challenger_id = v_uid AND ghost_id = p_ghost)
        OR (challenger_id = p_ghost AND ghost_id = v_uid)
      );
    IF v_n >= 3 THEN
      RETURN pg_catalog.jsonb_build_object('ok', false, 'reason', 'capped');
    END IF;
  ELSE
    SELECT pg_catalog.count(*) INTO v_n FROM public.ladder_matches
    WHERE kind = 'challenge'
      AND created_at > pg_catalog.now() - INTERVAL '1 day'
      AND (
        (challenger_id = v_uid AND ghost_id = p_ghost)
        OR (challenger_id = p_ghost AND ghost_id = v_uid)
      );
    IF v_n >= 8 THEN
      RETURN pg_catalog.jsonb_build_object('ok', false, 'reason', 'capped');
    END IF;
  END IF;

  -- After the caps, so "you've fought enough" is not reported as a throttle.
  IF NOT public.social_rate_limit('social_ticket') THEN
    RETURN pg_catalog.jsonb_build_object('ok', false, 'reason', 'slow');
  END IF;

  -- Lock both ladder rows in uuid order before either rating is read.
  IF v_uid < p_ghost THEN
    v_low := v_uid; v_high := p_ghost;
  ELSE
    v_low := p_ghost; v_high := v_uid;
  END IF;
  PERFORM public.ladder_touch(v_low);
  PERFORM public.ladder_touch(v_high);
  SELECT rating INTO v_my FROM public.ladder_players WHERE user_id = v_uid;
  SELECT rating INTO v_their FROM public.ladder_players WHERE user_id = p_ghost;

  BEGIN
    INSERT INTO public.ladder_matches (
      challenger_id, ghost_id, kind, deck, rival_name, label,
      challenger_rating, ghost_rating, season_id
    ) VALUES (
      v_uid, p_ghost, p_kind, v_ghost.deck,
      public.ladder_display_name(p_ghost), v_ghost.label,
      v_my, v_their, v_season
    )
    RETURNING * INTO v_match;
  EXCEPTION WHEN unique_violation THEN
    SELECT * INTO v_open FROM public.ladder_matches
    WHERE challenger_id = v_uid AND status = 'open'
    LIMIT 1;
    IF v_open.id IS NULL THEN
      RETURN pg_catalog.jsonb_build_object('ok', false, 'reason', 'slow');
    END IF;
    RETURN public.ladder_ticket(v_open) || pg_catalog.jsonb_build_object('reason', 'open');
  END;

  RETURN public.ladder_ticket(v_match);
END;
$$;

CREATE OR REPLACE FUNCTION public.draw_ghost()
RETURNS JSONB
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid    UUID := auth.uid();
  v_season TEXT;
  v_ghost  UUID;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not signed in' USING ERRCODE = 'PT401';
  END IF;

  -- Resume beats a new draw, and it must not spend the ticket limit.
  IF EXISTS (
    SELECT 1 FROM public.ladder_matches
    WHERE challenger_id = v_uid AND status = 'open'
      AND created_at > pg_catalog.now() - INTERVAL '45 minutes'
  ) THEN
    RETURN public.ladder_issue(
      (SELECT ghost_id FROM public.ladder_matches
       WHERE challenger_id = v_uid AND status = 'open' LIMIT 1),
      'queue'
    );
  END IF;

  v_season := public.ladder_season_id(pg_catalog.now());
  SELECT g.user_id INTO v_ghost
  FROM public.ghost_decks g
  WHERE g.user_id <> v_uid
    AND (
      SELECT pg_catalog.count(*) FROM public.ladder_matches m
      WHERE m.status = 'reported'
        AND m.season_id = v_season
        AND m.kind = 'queue'
        AND (
          (m.challenger_id = v_uid AND m.ghost_id = g.user_id)
          OR (m.challenger_id = g.user_id AND m.ghost_id = v_uid)
        )
    ) < 3
  ORDER BY pg_catalog.random()
  LIMIT 1;

  IF v_ghost IS NULL THEN
    IF NOT public.social_rate_limit('social_ticket') THEN
      RETURN pg_catalog.jsonb_build_object('ok', false, 'reason', 'slow');
    END IF;
    RETURN pg_catalog.jsonb_build_object('ok', false, 'reason', 'empty');
  END IF;

  RETURN public.ladder_issue(v_ghost, 'queue');
END;
$$;

CREATE OR REPLACE FUNCTION public.open_challenge(p_code TEXT)
RETURNS JSONB
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid   UUID := auth.uid();
  v_code  TEXT := pg_catalog.lower(pg_catalog.btrim(COALESCE(p_code, ''::text)));
  v_ghost UUID;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not signed in' USING ERRCODE = 'PT401';
  END IF;
  IF v_code !~ '^[0-9a-f]{10}$' THEN
    RETURN pg_catalog.jsonb_build_object('ok', false, 'reason', 'missing');
  END IF;

  SELECT user_id INTO v_ghost FROM public.ghost_decks WHERE code = v_code;
  IF v_ghost IS NULL THEN
    IF NOT public.social_rate_limit('social_ticket') THEN
      RETURN pg_catalog.jsonb_build_object('ok', false, 'reason', 'slow');
    END IF;
    RETURN pg_catalog.jsonb_build_object('ok', false, 'reason', 'missing');
  END IF;
  IF v_ghost = v_uid THEN
    RETURN pg_catalog.jsonb_build_object('ok', false, 'reason', 'self');
  END IF;

  RETURN public.ladder_issue(v_ghost, 'challenge');
END;
$$;

-- One attested result per ticket. p_forfeit forces a loss and skips the
-- short "a fight takes time" floor; a caller cannot combine it with a win.
-- A second call for a reported ticket returns the receipt it already stored.
CREATE OR REPLACE FUNCTION public.report_ladder_result(
  p_match_id UUID,
  p_won BOOLEAN,
  p_forfeit BOOLEAN DEFAULT FALSE
)
RETURNS JSONB
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid     UUID := auth.uid();
  v_match   public.ladder_matches%ROWTYPE;
  v_won     BOOLEAN;
  v_delta   INTEGER;
  v_theirs  INTEGER;
  v_applied INTEGER;
  v_low     UUID;
  v_high    UUID;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not signed in' USING ERRCODE = 'PT401';
  END IF;
  IF p_match_id IS NULL THEN
    RETURN pg_catalog.jsonb_build_object('ok', false, 'reason', 'missing');
  END IF;

  SELECT * INTO v_match FROM public.ladder_matches WHERE id = p_match_id FOR UPDATE;
  IF NOT FOUND OR v_match.challenger_id <> v_uid THEN
    IF NOT public.social_rate_limit('social_result') THEN
      RETURN pg_catalog.jsonb_build_object('ok', false, 'reason', 'slow');
    END IF;
    RETURN pg_catalog.jsonb_build_object('ok', false, 'reason', 'missing');
  END IF;

  IF v_match.status = 'reported' THEN
    RETURN public.ladder_receipt(v_match.id);
  END IF;

  IF NOT public.social_rate_limit('social_result') THEN
    RETURN pg_catalog.jsonb_build_object('ok', false, 'reason', 'slow');
  END IF;

  IF v_match.status <> 'open' THEN
    RETURN pg_catalog.jsonb_build_object('ok', false, 'reason', 'closed');
  END IF;

  -- A forfeit is a loss. The flag never upgrades a result into a win, so it
  -- cannot be used to skip the floor on a victory.
  v_won := COALESCE(p_won, false);
  IF COALESCE(p_forfeit, false) THEN
    v_won := false;
  ELSIF v_match.created_at > pg_catalog.now() - INTERVAL '8 seconds' THEN
    RETURN pg_catalog.jsonb_build_object('ok', false, 'reason', 'early');
  END IF;

  v_delta := public.ladder_delta(v_match.challenger_rating, v_match.ghost_rating, v_won);
  v_theirs := public.ladder_delta(v_match.ghost_rating, v_match.challenger_rating, NOT v_won);

  IF v_uid < v_match.ghost_id THEN
    v_low := v_uid; v_high := v_match.ghost_id;
  ELSE
    v_low := v_match.ghost_id; v_high := v_uid;
  END IF;
  PERFORM public.ladder_touch(v_low);
  PERFORM public.ladder_touch(v_high);

  IF v_uid = v_low THEN
    v_applied := public.ladder_grant(v_uid, v_delta, v_won);
    PERFORM public.ladder_grant(v_match.ghost_id, v_theirs, NOT v_won);
  ELSE
    PERFORM public.ladder_grant(v_match.ghost_id, v_theirs, NOT v_won);
    v_applied := public.ladder_grant(v_uid, v_delta, v_won);
  END IF;

  UPDATE public.ladder_matches SET
    status = 'reported',
    won = v_won,
    delta = v_applied,
    reported_at = pg_catalog.now()
  WHERE id = v_match.id;

  RETURN public.ladder_receipt(v_match.id);
END;
$$;

CREATE OR REPLACE FUNCTION public.forfeit_open_match()
RETURNS JSONB
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_id  UUID;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not signed in' USING ERRCODE = 'PT401';
  END IF;
  SELECT id INTO v_id FROM public.ladder_matches
  WHERE challenger_id = v_uid AND status = 'open'
  ORDER BY created_at DESC
  LIMIT 1;
  IF v_id IS NULL THEN
    RETURN pg_catalog.jsonb_build_object('ok', false, 'reason', 'missing');
  END IF;
  RETURN public.report_ladder_result(v_id, false, true);
END;
$$;

-- This week's board. A row whose season is older is shown as it will stand
-- after Monday's soft reset, with an empty week. No user id.
CREATE OR REPLACE FUNCTION public.weekly_board()
RETURNS TABLE (
  place BIGINT,
  username TEXT,
  rating INTEGER,
  tier TEXT,
  week_wins INTEGER,
  week_losses INTEGER,
  week_delta INTEGER,
  code TEXT,
  is_me BOOLEAN
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_season TEXT := public.ladder_season_id(pg_catalog.now());
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not signed in' USING ERRCODE = 'PT401';
  END IF;

  RETURN QUERY
  SELECT
    pg_catalog.rank() OVER (ORDER BY shown.rating DESC, shown.week_delta DESC, shown.username),
    shown.username,
    shown.rating,
    public.ladder_tier(shown.rating),
    shown.week_wins,
    shown.week_losses,
    shown.week_delta,
    shown.code,
    shown.is_me
  FROM (
    SELECT
      public.ladder_display_name(l.user_id) AS username,
      CASE WHEN l.season_id = v_season THEN l.rating ELSE public.ladder_soft(l.rating) END AS rating,
      CASE WHEN l.season_id = v_season THEN l.week_wins ELSE 0 END AS week_wins,
      CASE WHEN l.season_id = v_season THEN l.week_losses ELSE 0 END AS week_losses,
      CASE WHEN l.season_id = v_season THEN l.week_delta ELSE 0 END AS week_delta,
      g.code,
      COALESCE(l.user_id = auth.uid(), false) AS is_me
    FROM public.ladder_players l
    LEFT JOIN public.ghost_decks g ON g.user_id = l.user_id
  ) shown
  ORDER BY shown.rating DESC, shown.week_delta DESC, shown.username
  LIMIT 50;
END;
$$;

-- Another player's public card, looked up by their challenge code.
-- No deck and no user id: the deck arrives only on a ticket.
CREATE OR REPLACE FUNCTION public.public_card(p_code TEXT)
RETURNS TABLE (
  username TEXT,
  tier TEXT,
  rating INTEGER,
  peak_rating INTEGER,
  wins INTEGER,
  losses INTEGER,
  week_wins INTEGER,
  week_losses INTEGER,
  week_delta INTEGER,
  label TEXT,
  is_me BOOLEAN
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_code TEXT := pg_catalog.lower(pg_catalog.btrim(COALESCE(p_code, ''::text)));
  v_uid  UUID;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not signed in' USING ERRCODE = 'PT401';
  END IF;
  IF v_code !~ '^[0-9a-f]{10}$' THEN
    RETURN;
  END IF;

  SELECT user_id INTO v_uid FROM public.ghost_decks WHERE code = v_code;
  IF v_uid IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    public.ladder_display_name(v_uid),
    public.ladder_tier(CASE WHEN l.season_id = public.ladder_season_id(pg_catalog.now()) THEN l.rating ELSE public.ladder_soft(l.rating) END),
    CASE WHEN l.season_id = public.ladder_season_id(pg_catalog.now()) THEN l.rating ELSE public.ladder_soft(l.rating) END,
    l.peak_rating,
    l.wins,
    l.losses,
    CASE WHEN l.season_id = public.ladder_season_id(pg_catalog.now()) THEN l.week_wins ELSE 0 END,
    CASE WHEN l.season_id = public.ladder_season_id(pg_catalog.now()) THEN l.week_losses ELSE 0 END,
    CASE WHEN l.season_id = public.ladder_season_id(pg_catalog.now()) THEN l.week_delta ELSE 0 END,
    g.label,
    COALESCE(v_uid = auth.uid(), false)
  FROM public.ladder_players l
  JOIN public.ghost_decks g ON g.user_id = l.user_id
  WHERE l.user_id = v_uid;
END;
$$;

-- What a shared link may say before anyone is signed in. Safe for a preview:
-- a display name, a tier, a rating. Nothing else.
CREATE OR REPLACE FUNCTION public.challenge_preview(p_code TEXT)
RETURNS TABLE (
  username TEXT,
  tier TEXT,
  rating INTEGER
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_code TEXT := pg_catalog.lower(pg_catalog.btrim(COALESCE(p_code, ''::text)));
  v_uid  UUID;
BEGIN
  IF v_code !~ '^[0-9a-f]{10}$' THEN
    RETURN;
  END IF;
  SELECT user_id INTO v_uid FROM public.ghost_decks WHERE code = v_code;
  IF v_uid IS NULL THEN
    RETURN;
  END IF;
  RETURN QUERY
  SELECT
    public.ladder_display_name(v_uid),
    public.ladder_tier(CASE WHEN l.season_id = public.ladder_season_id(pg_catalog.now()) THEN l.rating ELSE public.ladder_soft(l.rating) END),
    CASE WHEN l.season_id = public.ladder_season_id(pg_catalog.now()) THEN l.rating ELSE public.ladder_soft(l.rating) END
  FROM public.ladder_players l
  WHERE l.user_id = v_uid;
END;
$$;

-- ---------------------------------------------------------------------------
-- Grants. Default privileges hand every new function to anon directly.
-- ---------------------------------------------------------------------------

REVOKE ALL ON FUNCTION public.ladder_season_id(TIMESTAMPTZ) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.ladder_soft(INTEGER) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.ladder_tier(INTEGER) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.ladder_delta(INTEGER, INTEGER, BOOLEAN) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.social_rate_limit(TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.ladder_touch(UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.ladder_grant(UUID, INTEGER, BOOLEAN) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.ladder_receipt(UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.ladder_ticket(public.ladder_matches) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.ladder_display_name(UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.ladder_issue(UUID, TEXT) FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.my_social() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_social() TO authenticated;

REVOKE ALL ON FUNCTION public.publish_ghost(INTEGER[], TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.publish_ghost(INTEGER[], TEXT) TO authenticated;

REVOKE ALL ON FUNCTION public.draw_ghost() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.draw_ghost() TO authenticated;

REVOKE ALL ON FUNCTION public.open_challenge(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.open_challenge(TEXT) TO authenticated;

REVOKE ALL ON FUNCTION public.report_ladder_result(UUID, BOOLEAN, BOOLEAN) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.report_ladder_result(UUID, BOOLEAN, BOOLEAN) TO authenticated;

REVOKE ALL ON FUNCTION public.forfeit_open_match() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.forfeit_open_match() TO authenticated;

REVOKE ALL ON FUNCTION public.weekly_board() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.weekly_board() TO authenticated;

REVOKE ALL ON FUNCTION public.public_card(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.public_card(TEXT) TO authenticated;

REVOKE ALL ON FUNCTION public.challenge_preview(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.challenge_preview(TEXT) TO anon, authenticated;
