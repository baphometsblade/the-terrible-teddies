-- The back room: follows, gangs, a weekly cup, taunts, fight slips,
-- a rival, a week-end ribbon, reports, and a referral.
-- One transaction. Clients never write the tables. Ratings still move only
-- inside these functions. Shared slips return no deck and no user id.

ALTER TABLE public.ladder_players ADD COLUMN IF NOT EXISTS ribbon TEXT;
ALTER TABLE public.ladder_players ADD COLUMN IF NOT EXISTS ribbon_season TEXT;
ALTER TABLE public.ladder_players ADD COLUMN IF NOT EXISTS referral_code TEXT;
ALTER TABLE public.ladder_players ADD COLUMN IF NOT EXISTS rival_id UUID;

ALTER TABLE public.ghost_decks ADD COLUMN IF NOT EXISTS greeting SMALLINT;
ALTER TABLE public.ladder_matches ADD COLUMN IF NOT EXISTS taunt SMALLINT;

ALTER TABLE public.ladder_matches DROP CONSTRAINT IF EXISTS ladder_matches_kind;
ALTER TABLE public.ladder_matches
  ADD CONSTRAINT ladder_matches_kind CHECK (kind IN ('queue', 'challenge', 'cup'));

CREATE UNIQUE INDEX IF NOT EXISTS ladder_players_referral_code_idx
  ON public.ladder_players (referral_code) WHERE referral_code IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.follows (
  follower   UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  followee   UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.now(),
  PRIMARY KEY (follower, followee),
  CONSTRAINT follows_not_self CHECK (follower <> followee)
);

CREATE TABLE IF NOT EXISTS public.gangs (
  id         UUID PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
  name       TEXT NOT NULL,
  tag        TEXT NOT NULL UNIQUE,
  founder    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.now()
);

CREATE TABLE IF NOT EXISTS public.gang_members (
  user_id   UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  gang_id   UUID NOT NULL REFERENCES public.gangs(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.now()
);

CREATE TABLE IF NOT EXISTS public.cup_entries (
  season_id TEXT NOT NULL,
  user_id   UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  entered_at TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.now(),
  PRIMARY KEY (season_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.player_reports (
  id         UUID PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
  reporter   UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  target     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reason     TEXT NOT NULL,
  day_key    DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.now(),
  CONSTRAINT player_reports_reason CHECK (reason IN ('name', 'cheat', 'spam')),
  CONSTRAINT player_reports_not_self CHECK (reporter <> target),
  UNIQUE (reporter, target, reason, day_key)
);

CREATE TABLE IF NOT EXISTS public.referrals (
  referee    UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  referrer   UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  season_id  TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.now(),
  CONSTRAINT referrals_not_self CHECK (referee <> referrer)
);

ALTER TABLE public.follows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gangs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gang_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cup_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.player_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.follows FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.gangs FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.gang_members FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.cup_entries FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.player_reports FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.referrals FROM PUBLIC, anon, authenticated;

-- Same limiter as before, with the back-room actions added. Unknown actions
-- still raise, and the window is still the server's.
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

-- Week rollover now leaves a ribbon, and every player gets a referral code.
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
  v_place  INTEGER;
  v_ribbon TEXT;
  v_try    INTEGER := 0;
  v_code   TEXT;
BEGIN
  INSERT INTO public.ladder_players (user_id, rating, peak_rating, season_id, day_key)
  VALUES (p_uid, 1000, 1000, v_season, v_day)
  ON CONFLICT (user_id) DO NOTHING;

  SELECT * INTO v_row FROM public.ladder_players WHERE user_id = p_uid FOR UPDATE;
  v_rating := v_row.rating;

  IF v_row.referral_code IS NULL THEN
    WHILE v_try < 5 AND v_code IS NULL LOOP
      v_try := v_try + 1;
      v_code := pg_catalog.substr(pg_catalog.md5(pg_catalog.gen_random_uuid()::text), 1, 10);
      BEGIN
        UPDATE public.ladder_players
        SET referral_code = v_code
        WHERE user_id = p_uid AND referral_code IS NULL;
      EXCEPTION WHEN unique_violation THEN
        v_code := NULL;
      END;
    END LOOP;
  END IF;

  IF v_row.season_id IS DISTINCT FROM v_season THEN
    IF (COALESCE(v_row.week_wins, 0) + COALESCE(v_row.week_losses, 0)) > 0
       AND v_row.ribbon_season IS DISTINCT FROM v_row.season_id THEN
      SELECT 1 + pg_catalog.count(*) INTO v_place
      FROM public.ladder_players o
      WHERE o.season_id = v_row.season_id
        AND o.user_id <> p_uid
        AND (o.week_wins + o.week_losses) > 0
        AND (
          o.week_delta > v_row.week_delta
          OR (o.week_delta = v_row.week_delta AND o.rating > v_row.rating)
        );
      v_ribbon := CASE
        WHEN v_place = 1 THEN 'Top stool'
        WHEN v_place <= 3 THEN 'On the podium'
        WHEN v_place <= 10 THEN 'Trouble'
        ELSE 'Showed up'
      END;
    END IF;

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
      ribbon = COALESCE(v_ribbon, ribbon),
      ribbon_season = CASE WHEN v_ribbon IS NOT NULL THEN v_row.season_id ELSE ribbon_season END,
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

-- A rating gift that is not a win and not a loss. The daily gain cap still applies.
CREATE OR REPLACE FUNCTION public.ladder_bonus(p_uid UUID, p_amount INTEGER)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_row     public.ladder_players%ROWTYPE;
  v_applied INTEGER := LEAST(GREATEST(COALESCE(p_amount, 0), 0), 15);
  v_room    INTEGER;
  v_rating  INTEGER;
BEGIN
  PERFORM public.ladder_touch(p_uid);
  SELECT * INTO v_row FROM public.ladder_players WHERE user_id = p_uid FOR UPDATE;
  v_room := GREATEST(0, 80 - v_row.day_gain);
  IF v_applied > v_room THEN v_applied := v_room; END IF;
  v_rating := LEAST(2400, GREATEST(100, v_row.rating + v_applied));
  v_applied := v_rating - v_row.rating;
  UPDATE public.ladder_players SET
    rating = v_rating,
    peak_rating = GREATEST(peak_rating, v_rating),
    day_gain = day_gain + (CASE WHEN v_applied > 0 THEN v_applied ELSE 0 END),
    updated_at = pg_catalog.now()
  WHERE user_id = p_uid;
  RETURN v_applied;
END;
$$;

CREATE OR REPLACE FUNCTION public.resolve_ghost(p_code TEXT)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT user_id FROM public.ghost_decks
  WHERE code = pg_catalog.lower(pg_catalog.btrim(COALESCE(p_code, ''::text)))
$$;

-- ---------------------------------------------------------------------------
-- Follows
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.follow_player(p_code TEXT)
RETURNS JSONB
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_who UUID;
  v_n   INTEGER;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not signed in' USING ERRCODE = 'PT401'; END IF;
  v_who := public.resolve_ghost(p_code);
  IF v_who IS NULL THEN RETURN pg_catalog.jsonb_build_object('ok', false, 'reason', 'missing'); END IF;
  IF v_who = v_uid THEN RETURN pg_catalog.jsonb_build_object('ok', false, 'reason', 'self'); END IF;
  SELECT pg_catalog.count(*) INTO v_n FROM public.follows WHERE follower = v_uid;
  IF v_n >= 40 THEN RETURN pg_catalog.jsonb_build_object('ok', false, 'reason', 'capped'); END IF;
  IF NOT public.social_rate_limit('social_follow') THEN
    RETURN pg_catalog.jsonb_build_object('ok', false, 'reason', 'slow');
  END IF;
  INSERT INTO public.follows (follower, followee) VALUES (v_uid, v_who)
  ON CONFLICT DO NOTHING;
  RETURN pg_catalog.jsonb_build_object('ok', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.unfollow_player(p_code TEXT)
RETURNS JSONB
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_who UUID;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not signed in' USING ERRCODE = 'PT401'; END IF;
  v_who := public.resolve_ghost(p_code);
  IF v_who IS NULL THEN RETURN pg_catalog.jsonb_build_object('ok', false, 'reason', 'missing'); END IF;
  DELETE FROM public.follows WHERE follower = v_uid AND followee = v_who;
  RETURN pg_catalog.jsonb_build_object('ok', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.list_follows()
RETURNS TABLE (
  username TEXT,
  rating INTEGER,
  tier TEXT,
  code TEXT,
  week_wins INTEGER,
  week_losses INTEGER
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
    public.ladder_display_name(f.followee),
    CASE WHEN l.season_id = v_season THEN l.rating ELSE public.ladder_soft(l.rating) END,
    public.ladder_tier(CASE WHEN l.season_id = v_season THEN l.rating ELSE public.ladder_soft(l.rating) END),
    g.code,
    CASE WHEN l.season_id = v_season THEN l.week_wins ELSE 0 END,
    CASE WHEN l.season_id = v_season THEN l.week_losses ELSE 0 END
  FROM public.follows f
  JOIN public.ladder_players l ON l.user_id = f.followee
  LEFT JOIN public.ghost_decks g ON g.user_id = f.followee
  WHERE f.follower = auth.uid()
  ORDER BY l.rating DESC
  LIMIT 40;
END;
$$;

-- ---------------------------------------------------------------------------
-- Gangs
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.create_gang(p_name TEXT, p_tag TEXT)
RETURNS JSONB
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid  UUID := auth.uid();
  v_name TEXT := pg_catalog.btrim(COALESCE(p_name, ''::text));
  v_tag  TEXT := pg_catalog.upper(pg_catalog.btrim(COALESCE(p_tag, ''::text)));
  v_id   UUID;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not signed in' USING ERRCODE = 'PT401'; END IF;
  IF pg_catalog.char_length(v_name) < 3 OR pg_catalog.char_length(v_name) > 20
     OR v_name !~ '^[A-Za-z0-9 _.!?-]+$' THEN
    RAISE EXCEPTION 'Gang name must be 3 to 20 ordinary characters' USING ERRCODE = '22023';
  END IF;
  IF v_tag !~ '^[A-Z]{3,4}$' THEN
    RAISE EXCEPTION 'Gang tag must be 3 or 4 letters' USING ERRCODE = '22023';
  END IF;
  IF EXISTS (SELECT 1 FROM public.gang_members WHERE user_id = v_uid) THEN
    RETURN pg_catalog.jsonb_build_object('ok', false, 'reason', 'in');
  END IF;
  IF NOT public.social_rate_limit('social_gang') THEN
    RETURN pg_catalog.jsonb_build_object('ok', false, 'reason', 'slow');
  END IF;
  BEGIN
    INSERT INTO public.gangs (name, tag, founder) VALUES (v_name, v_tag, v_uid) RETURNING id INTO v_id;
  EXCEPTION WHEN unique_violation THEN
    RETURN pg_catalog.jsonb_build_object('ok', false, 'reason', 'taken');
  END;
  INSERT INTO public.gang_members (user_id, gang_id) VALUES (v_uid, v_id);
  RETURN pg_catalog.jsonb_build_object('ok', true, 'tag', v_tag, 'name', v_name);
END;
$$;

CREATE OR REPLACE FUNCTION public.join_gang(p_tag TEXT)
RETURNS JSONB
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_tag TEXT := pg_catalog.upper(pg_catalog.btrim(COALESCE(p_tag, ''::text)));
  v_gang public.gangs%ROWTYPE;
  v_n INTEGER;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not signed in' USING ERRCODE = 'PT401'; END IF;
  IF v_tag !~ '^[A-Z]{3,4}$' THEN
    RETURN pg_catalog.jsonb_build_object('ok', false, 'reason', 'missing');
  END IF;
  IF EXISTS (SELECT 1 FROM public.gang_members WHERE user_id = v_uid) THEN
    RETURN pg_catalog.jsonb_build_object('ok', false, 'reason', 'in');
  END IF;
  SELECT * INTO v_gang FROM public.gangs WHERE tag = v_tag FOR UPDATE;
  IF NOT FOUND THEN RETURN pg_catalog.jsonb_build_object('ok', false, 'reason', 'missing'); END IF;
  SELECT pg_catalog.count(*) INTO v_n FROM public.gang_members WHERE gang_id = v_gang.id;
  IF v_n >= 12 THEN RETURN pg_catalog.jsonb_build_object('ok', false, 'reason', 'capped'); END IF;
  IF NOT public.social_rate_limit('social_gang') THEN
    RETURN pg_catalog.jsonb_build_object('ok', false, 'reason', 'slow');
  END IF;
  INSERT INTO public.gang_members (user_id, gang_id) VALUES (v_uid, v_gang.id);
  RETURN pg_catalog.jsonb_build_object('ok', true, 'tag', v_gang.tag, 'name', v_gang.name);
END;
$$;

CREATE OR REPLACE FUNCTION public.leave_gang()
RETURNS JSONB
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_gang UUID;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not signed in' USING ERRCODE = 'PT401'; END IF;
  SELECT gang_id INTO v_gang FROM public.gang_members WHERE user_id = v_uid;
  IF v_gang IS NULL THEN RETURN pg_catalog.jsonb_build_object('ok', false, 'reason', 'missing'); END IF;
  DELETE FROM public.gang_members WHERE user_id = v_uid;
  IF NOT EXISTS (SELECT 1 FROM public.gang_members WHERE gang_id = v_gang) THEN
    DELETE FROM public.gangs WHERE id = v_gang;
  END IF;
  RETURN pg_catalog.jsonb_build_object('ok', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.gang_board()
RETURNS TABLE (
  place BIGINT,
  tag TEXT,
  name TEXT,
  members INTEGER,
  rating INTEGER
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
    shown.rating
  FROM (
    SELECT
      g.tag,
      g.name,
      pg_catalog.count(m.user_id)::INTEGER AS members,
      COALESCE(pg_catalog.sum(
        CASE WHEN l.season_id = v_season THEN l.rating ELSE public.ladder_soft(l.rating) END
      ), 0)::INTEGER AS rating
    FROM public.gangs g
    JOIN public.gang_members m ON m.gang_id = g.id
    LEFT JOIN public.ladder_players l ON l.user_id = m.user_id
    GROUP BY g.id, g.tag, g.name
  ) shown
  ORDER BY shown.rating DESC, shown.tag
  LIMIT 30;
END;
$$;

-- ---------------------------------------------------------------------------
-- Weekly cup. Three pairings against other entrants' decks.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.enter_cup()
RETURNS JSONB
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_season TEXT;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not signed in' USING ERRCODE = 'PT401'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.ghost_decks WHERE user_id = v_uid) THEN
    RETURN pg_catalog.jsonb_build_object('ok', false, 'reason', 'deck');
  END IF;
  IF NOT public.social_rate_limit('social_cup') THEN
    RETURN pg_catalog.jsonb_build_object('ok', false, 'reason', 'slow');
  END IF;
  PERFORM public.ladder_touch(v_uid);
  v_season := public.ladder_season_id(pg_catalog.now());
  INSERT INTO public.cup_entries (season_id, user_id) VALUES (v_season, v_uid)
  ON CONFLICT DO NOTHING;
  RETURN pg_catalog.jsonb_build_object('ok', true, 'season_id', v_season);
END;
$$;

CREATE OR REPLACE FUNCTION public.draw_cup()
RETURNS JSONB
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_season TEXT;
  v_open public.ladder_matches%ROWTYPE;
  v_played INTEGER;
  v_opp UUID;
  v_my INTEGER;
  v_their INTEGER;
  v_ghost public.ghost_decks%ROWTYPE;
  v_match public.ladder_matches%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not signed in' USING ERRCODE = 'PT401'; END IF;
  v_season := public.ladder_season_id(pg_catalog.now());
  IF NOT EXISTS (SELECT 1 FROM public.cup_entries WHERE season_id = v_season AND user_id = v_uid) THEN
    RETURN pg_catalog.jsonb_build_object('ok', false, 'reason', 'missing');
  END IF;

  UPDATE public.ladder_matches SET status = 'expired'
  WHERE challenger_id = v_uid AND status = 'open'
    AND created_at <= pg_catalog.now() - INTERVAL '45 minutes';

  SELECT * INTO v_open FROM public.ladder_matches
  WHERE challenger_id = v_uid AND status = 'open' LIMIT 1;
  IF v_open.id IS NOT NULL THEN
    RETURN public.ladder_ticket(v_open) || pg_catalog.jsonb_build_object('reason', 'open');
  END IF;

  SELECT pg_catalog.count(*) INTO v_played FROM public.ladder_matches
  WHERE status = 'reported' AND kind = 'cup' AND season_id = v_season AND challenger_id = v_uid;
  IF v_played >= 3 THEN
    RETURN pg_catalog.jsonb_build_object('ok', false, 'reason', 'capped');
  END IF;

  SELECT g.user_id INTO v_opp
  FROM public.cup_entries e
  JOIN public.ghost_decks g ON g.user_id = e.user_id
  JOIN public.ladder_players l ON l.user_id = e.user_id
  WHERE e.season_id = v_season
    AND e.user_id <> v_uid
    AND NOT EXISTS (
      SELECT 1 FROM public.ladder_matches m
      WHERE m.kind = 'cup' AND m.season_id = v_season AND m.status = 'reported'
        AND (
          (m.challenger_id = v_uid AND m.ghost_id = e.user_id)
          OR (m.challenger_id = e.user_id AND m.ghost_id = v_uid)
        )
    )
  ORDER BY pg_catalog.abs(l.rating - (SELECT rating FROM public.ladder_players WHERE user_id = v_uid)), e.user_id
  LIMIT 1;

  IF v_opp IS NULL THEN
    RETURN pg_catalog.jsonb_build_object('ok', false, 'reason', 'empty');
  END IF;

  IF NOT public.social_rate_limit('social_cup') THEN
    RETURN pg_catalog.jsonb_build_object('ok', false, 'reason', 'slow');
  END IF;

  PERFORM public.ladder_touch(LEAST(v_uid, v_opp));
  PERFORM public.ladder_touch(GREATEST(v_uid, v_opp));
  SELECT rating INTO v_my FROM public.ladder_players WHERE user_id = v_uid;
  SELECT rating INTO v_their FROM public.ladder_players WHERE user_id = v_opp;
  SELECT * INTO v_ghost FROM public.ghost_decks WHERE user_id = v_opp;

  BEGIN
    INSERT INTO public.ladder_matches (
      challenger_id, ghost_id, kind, deck, rival_name, label,
      challenger_rating, ghost_rating, season_id
    ) VALUES (
      v_uid, v_opp, 'cup', v_ghost.deck,
      public.ladder_display_name(v_opp), v_ghost.label,
      v_my, v_their, v_season
    ) RETURNING * INTO v_match;
  EXCEPTION WHEN unique_violation THEN
    SELECT * INTO v_open FROM public.ladder_matches
    WHERE challenger_id = v_uid AND status = 'open' LIMIT 1;
    IF v_open.id IS NULL THEN
      RETURN pg_catalog.jsonb_build_object('ok', false, 'reason', 'slow');
    END IF;
    RETURN public.ladder_ticket(v_open) || pg_catalog.jsonb_build_object('reason', 'open');
  END;

  RETURN public.ladder_ticket(v_match);
END;
$$;

CREATE OR REPLACE FUNCTION public.cup_table()
RETURNS TABLE (
  place BIGINT,
  username TEXT,
  wins INTEGER,
  played INTEGER
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
    pg_catalog.rank() OVER (ORDER BY shown.wins DESC, shown.played DESC, shown.username),
    shown.username,
    shown.wins,
    shown.played
  FROM (
    SELECT
      public.ladder_display_name(e.user_id) AS username,
      (
        SELECT pg_catalog.count(*)::INTEGER FROM public.ladder_matches m
        WHERE m.kind = 'cup' AND m.season_id = v_season AND m.status = 'reported'
          AND (
            (m.challenger_id = e.user_id AND m.won)
            OR (m.ghost_id = e.user_id AND NOT m.won)
          )
      ) AS wins,
      (
        SELECT pg_catalog.count(*)::INTEGER FROM public.ladder_matches m
        WHERE m.kind = 'cup' AND m.season_id = v_season AND m.status = 'reported'
          AND (m.challenger_id = e.user_id OR m.ghost_id = e.user_id)
      ) AS played
    FROM public.cup_entries e
    WHERE e.season_id = v_season
  ) shown
  ORDER BY shown.wins DESC, shown.played DESC, shown.username
  LIMIT 40;
END;
$$;

-- ---------------------------------------------------------------------------
-- Taunts, rival, lineup, reports, referral, the room summary, the public slip
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.set_greeting(p_taunt INTEGER)
RETURNS JSONB
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid UUID := auth.uid();
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not signed in' USING ERRCODE = 'PT401'; END IF;
  IF p_taunt IS NULL OR p_taunt < 1 OR p_taunt > 8 THEN
    RETURN pg_catalog.jsonb_build_object('ok', false, 'reason', 'missing');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.ghost_decks WHERE user_id = v_uid) THEN
    RETURN pg_catalog.jsonb_build_object('ok', false, 'reason', 'deck');
  END IF;
  IF NOT public.social_rate_limit('social_taunt') THEN
    RETURN pg_catalog.jsonb_build_object('ok', false, 'reason', 'slow');
  END IF;
  UPDATE public.ghost_decks SET greeting = p_taunt WHERE user_id = v_uid;
  RETURN pg_catalog.jsonb_build_object('ok', true, 'taunt', p_taunt);
END;
$$;

CREATE OR REPLACE FUNCTION public.set_match_taunt(p_match_id UUID, p_taunt INTEGER)
RETURNS JSONB
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid UUID := auth.uid();
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not signed in' USING ERRCODE = 'PT401'; END IF;
  IF p_taunt IS NULL OR p_taunt < 1 OR p_taunt > 8 THEN
    RETURN pg_catalog.jsonb_build_object('ok', false, 'reason', 'missing');
  END IF;
  IF NOT public.social_rate_limit('social_taunt') THEN
    RETURN pg_catalog.jsonb_build_object('ok', false, 'reason', 'slow');
  END IF;
  UPDATE public.ladder_matches
  SET taunt = p_taunt
  WHERE id = p_match_id AND challenger_id = v_uid AND status = 'reported' AND taunt IS NULL;
  IF NOT FOUND THEN
    RETURN pg_catalog.jsonb_build_object('ok', false, 'reason', 'closed');
  END IF;
  RETURN pg_catalog.jsonb_build_object('ok', true, 'taunt', p_taunt);
END;
$$;

CREATE OR REPLACE FUNCTION public.match_aside(p_match_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_ghost UUID;
  v_greet SMALLINT;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not signed in' USING ERRCODE = 'PT401'; END IF;
  SELECT ghost_id INTO v_ghost FROM public.ladder_matches
  WHERE id = p_match_id AND challenger_id = v_uid;
  IF v_ghost IS NULL THEN
    RETURN pg_catalog.jsonb_build_object('ok', false, 'reason', 'missing');
  END IF;
  SELECT greeting INTO v_greet FROM public.ghost_decks WHERE user_id = v_ghost;
  RETURN pg_catalog.jsonb_build_object('ok', true, 'greeting', v_greet);
END;
$$;

CREATE OR REPLACE FUNCTION public.set_rival(p_code TEXT)
RETURNS JSONB
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_who UUID;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not signed in' USING ERRCODE = 'PT401'; END IF;
  IF p_code IS NULL OR pg_catalog.btrim(p_code) = '' THEN
    UPDATE public.ladder_players SET rival_id = NULL WHERE user_id = v_uid;
    RETURN pg_catalog.jsonb_build_object('ok', true, 'cleared', true);
  END IF;
  v_who := public.resolve_ghost(p_code);
  IF v_who IS NULL THEN RETURN pg_catalog.jsonb_build_object('ok', false, 'reason', 'missing'); END IF;
  IF v_who = v_uid THEN RETURN pg_catalog.jsonb_build_object('ok', false, 'reason', 'self'); END IF;
  IF NOT public.social_rate_limit('social_rival') THEN
    RETURN pg_catalog.jsonb_build_object('ok', false, 'reason', 'slow');
  END IF;
  PERFORM public.ladder_touch(v_uid);
  UPDATE public.ladder_players SET rival_id = v_who WHERE user_id = v_uid;
  RETURN pg_catalog.jsonb_build_object('ok', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.lineup(p_code TEXT)
RETURNS JSONB
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_deck INTEGER[];
  v_name TEXT;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not signed in' USING ERRCODE = 'PT401'; END IF;
  IF NOT public.social_rate_limit('social_lineup') THEN
    RETURN pg_catalog.jsonb_build_object('ok', false, 'reason', 'slow');
  END IF;
  SELECT deck INTO v_deck FROM public.ghost_decks WHERE code = pg_catalog.lower(pg_catalog.btrim(COALESCE(p_code, ''::text)));
  IF v_deck IS NULL THEN RETURN pg_catalog.jsonb_build_object('ok', false, 'reason', 'missing'); END IF;
  v_name := public.ladder_display_name(public.resolve_ghost(p_code));
  RETURN pg_catalog.jsonb_build_object('ok', true, 'deck', pg_catalog.to_jsonb(v_deck), 'username', v_name);
END;
$$;

CREATE OR REPLACE FUNCTION public.submit_report(p_code TEXT, p_reason TEXT)
RETURNS JSONB
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_who UUID;
  v_reason TEXT := pg_catalog.lower(pg_catalog.btrim(COALESCE(p_reason, ''::text)));
  v_day DATE := (pg_catalog.timezone('utc', pg_catalog.now()))::date;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not signed in' USING ERRCODE = 'PT401'; END IF;
  IF v_reason NOT IN ('name', 'cheat', 'spam') THEN
    RETURN pg_catalog.jsonb_build_object('ok', false, 'reason', 'missing');
  END IF;
  v_who := public.resolve_ghost(p_code);
  IF v_who IS NULL THEN RETURN pg_catalog.jsonb_build_object('ok', false, 'reason', 'missing'); END IF;
  IF v_who = v_uid THEN RETURN pg_catalog.jsonb_build_object('ok', false, 'reason', 'self'); END IF;
  IF NOT public.social_rate_limit('social_report') THEN
    RETURN pg_catalog.jsonb_build_object('ok', false, 'reason', 'slow');
  END IF;
  INSERT INTO public.player_reports (reporter, target, reason, day_key)
  VALUES (v_uid, v_who, v_reason, v_day)
  ON CONFLICT DO NOTHING;
  RETURN pg_catalog.jsonb_build_object('ok', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.redeem_referral(p_code TEXT)
RETURNS JSONB
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_code TEXT := pg_catalog.lower(pg_catalog.btrim(COALESCE(p_code, ''::text)));
  v_who UUID;
  v_season TEXT;
  v_n INTEGER;
  v_mine INTEGER := 0;
  v_theirs INTEGER := 0;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not signed in' USING ERRCODE = 'PT401'; END IF;
  IF v_code !~ '^[0-9a-f]{10}$' THEN
    RETURN pg_catalog.jsonb_build_object('ok', false, 'reason', 'missing');
  END IF;
  IF EXISTS (SELECT 1 FROM public.referrals WHERE referee = v_uid) THEN
    RETURN pg_catalog.jsonb_build_object('ok', false, 'reason', 'used');
  END IF;
  SELECT user_id INTO v_who FROM public.ladder_players WHERE referral_code = v_code;
  IF v_who IS NULL THEN RETURN pg_catalog.jsonb_build_object('ok', false, 'reason', 'missing'); END IF;
  IF v_who = v_uid THEN RETURN pg_catalog.jsonb_build_object('ok', false, 'reason', 'self'); END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.ladder_matches
    WHERE challenger_id = v_uid AND status = 'reported'
  ) THEN
    RETURN pg_catalog.jsonb_build_object('ok', false, 'reason', 'play');
  END IF;
  IF NOT public.social_rate_limit('social_refer') THEN
    RETURN pg_catalog.jsonb_build_object('ok', false, 'reason', 'slow');
  END IF;
  v_season := public.ladder_season_id(pg_catalog.now());
  SELECT pg_catalog.count(*) INTO v_n FROM public.referrals
  WHERE referrer = v_who AND season_id = v_season;
  INSERT INTO public.referrals (referee, referrer, season_id) VALUES (v_uid, v_who, v_season);
  v_mine := public.ladder_bonus(v_uid, 15);
  IF v_n < 5 THEN
    v_theirs := public.ladder_bonus(v_who, 15);
  END IF;
  RETURN pg_catalog.jsonb_build_object('ok', true, 'bonus', v_mine, 'theirs', v_theirs);
END;
$$;

CREATE OR REPLACE FUNCTION public.my_room()
RETURNS JSONB
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_row public.ladder_players%ROWTYPE;
  v_gang_name TEXT;
  v_gang_tag TEXT;
  v_members INTEGER;
  v_rival UUID;
  v_hw INTEGER := 0;
  v_hl INTEGER := 0;
  v_season TEXT;
  v_cup_in BOOLEAN;
  v_cup_played INTEGER := 0;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not signed in' USING ERRCODE = 'PT401'; END IF;
  PERFORM public.ladder_touch(v_uid);
  SELECT * INTO v_row FROM public.ladder_players WHERE user_id = v_uid;
  SELECT g.name, g.tag INTO v_gang_name, v_gang_tag
  FROM public.gang_members m JOIN public.gangs g ON g.id = m.gang_id
  WHERE m.user_id = v_uid;
  IF v_gang_tag IS NOT NULL THEN
    SELECT pg_catalog.count(*) INTO v_members FROM public.gang_members m
    JOIN public.gangs g ON g.id = m.gang_id WHERE g.tag = v_gang_tag;
  END IF;
  v_rival := v_row.rival_id;
  IF v_rival IS NOT NULL THEN
    SELECT
      pg_catalog.count(*) FILTER (
        WHERE (challenger_id = v_uid AND ghost_id = v_rival AND won)
           OR (challenger_id = v_rival AND ghost_id = v_uid AND NOT won)
      ),
      pg_catalog.count(*) FILTER (
        WHERE (challenger_id = v_uid AND ghost_id = v_rival AND NOT won)
           OR (challenger_id = v_rival AND ghost_id = v_uid AND won)
      )
    INTO v_hw, v_hl
    FROM public.ladder_matches
    WHERE status = 'reported'
      AND (
        (challenger_id = v_uid AND ghost_id = v_rival)
        OR (challenger_id = v_rival AND ghost_id = v_uid)
      );
  END IF;
  v_season := public.ladder_season_id(pg_catalog.now());
  v_cup_in := EXISTS (SELECT 1 FROM public.cup_entries WHERE season_id = v_season AND user_id = v_uid);
  SELECT pg_catalog.count(*) INTO v_cup_played FROM public.ladder_matches
  WHERE kind = 'cup' AND season_id = v_season AND status = 'reported' AND challenger_id = v_uid;

  RETURN pg_catalog.jsonb_build_object(
    'ok', true,
    'ribbon', v_row.ribbon,
    'ribbon_season', v_row.ribbon_season,
    'referral_code', v_row.referral_code,
    'greeting', (SELECT greeting FROM public.ghost_decks WHERE user_id = v_uid),
    'gang', CASE WHEN v_gang_tag IS NULL THEN NULL ELSE pg_catalog.jsonb_build_object(
      'name', v_gang_name, 'tag', v_gang_tag, 'members', v_members
    ) END,
    'rival', CASE WHEN v_rival IS NULL THEN NULL ELSE pg_catalog.jsonb_build_object(
      'username', public.ladder_display_name(v_rival),
      'code', (SELECT code FROM public.ghost_decks WHERE user_id = v_rival),
      'wins', v_hw,
      'losses', v_hl
    ) END,
    'cup', pg_catalog.jsonb_build_object('entered', v_cup_in, 'played', v_cup_played),
    'follows', (SELECT pg_catalog.count(*) FROM public.follows WHERE follower = v_uid)
  );
END;
$$;

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
END;
$$;

REVOKE ALL ON FUNCTION public.social_rate_limit(TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.ladder_touch(UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.ladder_bonus(UUID, INTEGER) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.resolve_ghost(TEXT) FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.follow_player(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.follow_player(TEXT) TO authenticated;
REVOKE ALL ON FUNCTION public.unfollow_player(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.unfollow_player(TEXT) TO authenticated;
REVOKE ALL ON FUNCTION public.list_follows() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_follows() TO authenticated;

REVOKE ALL ON FUNCTION public.create_gang(TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_gang(TEXT, TEXT) TO authenticated;
REVOKE ALL ON FUNCTION public.join_gang(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.join_gang(TEXT) TO authenticated;
REVOKE ALL ON FUNCTION public.leave_gang() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.leave_gang() TO authenticated;
REVOKE ALL ON FUNCTION public.gang_board() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.gang_board() TO authenticated;

REVOKE ALL ON FUNCTION public.enter_cup() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.enter_cup() TO authenticated;
REVOKE ALL ON FUNCTION public.draw_cup() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.draw_cup() TO authenticated;
REVOKE ALL ON FUNCTION public.cup_table() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cup_table() TO authenticated;

REVOKE ALL ON FUNCTION public.set_greeting(INTEGER) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_greeting(INTEGER) TO authenticated;
REVOKE ALL ON FUNCTION public.set_match_taunt(UUID, INTEGER) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_match_taunt(UUID, INTEGER) TO authenticated;
REVOKE ALL ON FUNCTION public.match_aside(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.match_aside(UUID) TO authenticated;

REVOKE ALL ON FUNCTION public.set_rival(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_rival(TEXT) TO authenticated;
REVOKE ALL ON FUNCTION public.lineup(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.lineup(TEXT) TO authenticated;
REVOKE ALL ON FUNCTION public.submit_report(TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_report(TEXT, TEXT) TO authenticated;
REVOKE ALL ON FUNCTION public.redeem_referral(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.redeem_referral(TEXT) TO authenticated;
REVOKE ALL ON FUNCTION public.my_room() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_room() TO authenticated;

REVOKE ALL ON FUNCTION public.slip_preview(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.slip_preview(UUID) TO anon, authenticated;
