-- Finished fights, as a log the engine can walk. Not a film.
-- A row is a few kilobytes: seed, deck ids, rules, ordered intents, hash.
-- Client roles do not read the table. replay_open is the door, and it stays
-- shut until the live match, if there is one, is over.

CREATE TABLE IF NOT EXISTS public.match_replays (
  id           UUID PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
  match_id     UUID,
  owner_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  opponent_id  UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  kind         TEXT NOT NULL,
  privacy      TEXT NOT NULL DEFAULT 'participants',
  share_code   TEXT UNIQUE,
  starred      BOOLEAN NOT NULL DEFAULT FALSE,
  log          JSONB NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.now(),
  CONSTRAINT match_replays_kind CHECK (kind IN ('pvp', 'ghost', 'house')),
  CONSTRAINT match_replays_privacy CHECK (privacy IN ('participants', 'friends', 'public')),
  CONSTRAINT match_replays_size CHECK (pg_catalog.octet_length(log::text) <= 8192)
);

CREATE INDEX IF NOT EXISTS match_replays_owner_idx
  ON public.match_replays (owner_id, created_at DESC);

CREATE INDEX IF NOT EXISTS match_replays_opponent_idx
  ON public.match_replays (opponent_id, created_at DESC);

ALTER TABLE public.match_replays ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.match_replays FROM PUBLIC, anon, authenticated;

-- Last 50 ordinary tapes per player, whether they dealt or sat across.
-- A tape stays while either participant still has it in that window.
-- Starred and shared rows are not ordinary, so they stay.
CREATE OR REPLACE FUNCTION public.replay_prune(p_owner UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_n INTEGER;
BEGIN
  WITH ordinary AS (
    SELECT id, owner_id, opponent_id, created_at
    FROM public.match_replays
    WHERE starred = FALSE AND share_code IS NULL
  ),
  sides AS (
    SELECT id, owner_id AS player, created_at FROM ordinary
    UNION ALL
    SELECT id, opponent_id AS player, created_at FROM ordinary
    WHERE opponent_id IS NOT NULL
  ),
  ranked AS (
    SELECT id, player,
      pg_catalog.row_number() OVER (PARTITION BY player ORDER BY created_at DESC) AS n
    FROM sides
  ),
  doomed AS (
    DELETE FROM public.match_replays r
    WHERE r.starred = FALSE
      AND r.share_code IS NULL
      AND (p_owner IS NULL OR r.owner_id = p_owner OR r.opponent_id = p_owner)
      AND NOT EXISTS (
        SELECT 1 FROM ranked k WHERE k.id = r.id AND k.n <= 50
      )
    RETURNING r.id
  )
  SELECT pg_catalog.count(*) INTO v_n FROM doomed;
  RETURN COALESCE(v_n, 0);
END;
$$;

CREATE OR REPLACE FUNCTION public.replay_put(
  p_owner UUID,
  p_opponent UUID,
  p_match UUID,
  p_log JSONB
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_id UUID;
BEGIN
  IF p_owner IS NULL OR p_log IS NULL THEN
    RETURN pg_catalog.jsonb_build_object('ok', false, 'error', 'bad');
  END IF;
  IF pg_catalog.octet_length(p_log::text) > 8192 THEN
    RETURN pg_catalog.jsonb_build_object('ok', false, 'error', 'size');
  END IF;
  -- Must match ENGINE_VERSION in src/lib/combat/engine.js. A different
  -- version is refused here and flagged incompatible by the player.
  IF COALESCE((p_log->>'v')::integer, 0) <> 1 THEN
    RETURN pg_catalog.jsonb_build_object('ok', false, 'error', 'incompatible');
  END IF;
  IF p_match IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.pvp_matches m
    WHERE m.id = p_match AND m.status = 'active'
  ) THEN
    RETURN pg_catalog.jsonb_build_object('ok', false, 'error', 'live');
  END IF;
  INSERT INTO public.match_replays (match_id, owner_id, opponent_id, kind, log)
  VALUES (
    p_match, p_owner, p_opponent,
    COALESCE(p_log->>'kind', 'pvp'),
    p_log
  )
  RETURNING id INTO v_id;
  PERFORM public.replay_prune(p_owner);
  RETURN pg_catalog.jsonb_build_object('ok', true, 'id', v_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.replay_allowed(
  p_row public.match_replays,
  p_uid UUID,
  p_code TEXT
) RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF p_uid IS NOT NULL AND (p_uid = p_row.owner_id OR p_uid = p_row.opponent_id) THEN
    RETURN TRUE;
  END IF;
  IF p_row.privacy IN ('friends', 'public') AND p_uid IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.follows f
    WHERE f.follower = p_uid AND f.followee = p_row.owner_id
  ) THEN
    RETURN TRUE;
  END IF;
  IF p_row.privacy = 'public' AND p_row.share_code IS NOT NULL
     AND p_code IS NOT NULL AND p_code = p_row.share_code THEN
    RETURN TRUE;
  END IF;
  RETURN FALSE;
END;
$$;

CREATE OR REPLACE FUNCTION public.replay_open(p_id UUID, p_code TEXT)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_row public.match_replays%ROWTYPE;
  v_uid UUID := auth.uid();
BEGIN
  IF p_code IS NOT NULL AND p_code <> '' THEN
    SELECT * INTO v_row FROM public.match_replays WHERE share_code = p_code;
  ELSE
    SELECT * INTO v_row FROM public.match_replays WHERE id = p_id;
  END IF;
  IF NOT FOUND THEN
    RETURN pg_catalog.jsonb_build_object('ok', false, 'error', 'missing');
  END IF;
  IF NOT public.replay_allowed(v_row, v_uid, NULLIF(p_code, '')) THEN
    RETURN pg_catalog.jsonb_build_object('ok', false, 'error', 'private');
  END IF;
  RETURN pg_catalog.jsonb_build_object(
    'ok', true,
    'id', v_row.id,
    'kind', v_row.kind,
    'privacy', v_row.privacy,
    'starred', v_row.starred,
    'share_code', CASE WHEN v_uid = v_row.owner_id THEN v_row.share_code ELSE NULL END,
    'log', v_row.log
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.replay_summary(p_row public.match_replays)
RETURNS JSONB
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT pg_catalog.jsonb_build_object(
    'id', p_row.id,
    'kind', p_row.kind,
    'privacy', p_row.privacy,
    'starred', p_row.starred,
    'names', p_row.log->'names',
    'created_at', p_row.created_at
  );
$$;

CREATE OR REPLACE FUNCTION public.replay_mine()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid UUID := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RETURN pg_catalog.jsonb_build_object('ok', false, 'error', 'auth');
  END IF;
  RETURN pg_catalog.jsonb_build_object(
    'ok', true,
    'rows', COALESCE((
      SELECT pg_catalog.jsonb_agg(public.replay_summary(r) ORDER BY r.created_at DESC)
      FROM public.match_replays r
      WHERE r.owner_id = v_uid OR r.opponent_id = v_uid
    ), '[]'::jsonb)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.replay_feed()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid UUID := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RETURN pg_catalog.jsonb_build_object('ok', false, 'error', 'auth');
  END IF;
  RETURN pg_catalog.jsonb_build_object(
    'ok', true,
    'rows', COALESCE((
      SELECT pg_catalog.jsonb_agg(s.summary ORDER BY s.created_at DESC)
      FROM (
        SELECT public.replay_summary(r) AS summary, r.created_at
        FROM public.match_replays r
        JOIN public.follows f ON f.followee = r.owner_id AND f.follower = v_uid
        WHERE r.privacy IN ('friends', 'public')
        ORDER BY r.created_at DESC
        LIMIT 30
      ) s
    ), '[]'::jsonb)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.replay_for_match(p_match UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_row public.match_replays%ROWTYPE;
BEGIN
  SELECT * INTO v_row FROM public.match_replays
  WHERE match_id = p_match AND (owner_id = v_uid OR opponent_id = v_uid)
  ORDER BY created_at DESC LIMIT 1;
  IF NOT FOUND THEN
    RETURN pg_catalog.jsonb_build_object('ok', false, 'error', 'missing');
  END IF;
  RETURN pg_catalog.jsonb_build_object('ok', true, 'id', v_row.id);
END;
$$;

CREATE OR REPLACE FUNCTION public.replay_star(p_id UUID, p_on BOOLEAN)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid UUID := auth.uid();
BEGIN
  UPDATE public.match_replays
  SET starred = COALESCE(p_on, FALSE)
  WHERE id = p_id AND owner_id = v_uid;
  IF NOT FOUND THEN
    RETURN pg_catalog.jsonb_build_object('ok', false, 'error', 'missing');
  END IF;
  RETURN pg_catalog.jsonb_build_object('ok', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.replay_share(p_id UUID, p_privacy TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_privacy TEXT := CASE
    WHEN p_privacy IN ('participants', 'friends', 'public') THEN p_privacy
    ELSE 'public'
  END;
  v_code TEXT;
BEGIN
  UPDATE public.match_replays
  SET privacy = v_privacy,
      share_code = COALESCE(share_code, pg_catalog.substr(pg_catalog.replace(pg_catalog.gen_random_uuid()::text, '-', ''), 1, 12))
  WHERE id = p_id AND owner_id = v_uid
  RETURNING share_code INTO v_code;
  IF NOT FOUND THEN
    RETURN pg_catalog.jsonb_build_object('ok', false, 'error', 'missing');
  END IF;
  RETURN pg_catalog.jsonb_build_object('ok', true, 'code', v_code, 'privacy', v_privacy);
END;
$$;

-- The public slip may link a tape only when the owner already made it public.
CREATE OR REPLACE FUNCTION public.replay_slip(p_match UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_code TEXT;
BEGIN
  SELECT share_code INTO v_code
  FROM public.match_replays
  WHERE match_id = p_match
    AND privacy = 'public'
    AND share_code IS NOT NULL
  ORDER BY created_at DESC
  LIMIT 1;
  IF NOT FOUND THEN
    RETURN pg_catalog.jsonb_build_object('ok', false);
  END IF;
  RETURN pg_catalog.jsonb_build_object('ok', true, 'code', v_code);
END;
$$;

REVOKE ALL ON FUNCTION public.replay_prune(UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.replay_slip(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.replay_put(UUID, UUID, UUID, JSONB) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.replay_allowed(public.match_replays, UUID, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.replay_summary(public.match_replays) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.replay_open(UUID, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.replay_mine() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.replay_feed() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.replay_for_match(UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.replay_star(UUID, BOOLEAN) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.replay_share(UUID, TEXT) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.replay_prune(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.replay_put(UUID, UUID, UUID, JSONB) TO service_role;
GRANT EXECUTE ON FUNCTION public.replay_open(UUID, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.replay_slip(UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.replay_mine() TO authenticated;
GRANT EXECUTE ON FUNCTION public.replay_feed() TO authenticated;
GRANT EXECUTE ON FUNCTION public.replay_for_match(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.replay_star(UUID, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION public.replay_share(UUID, TEXT) TO authenticated;
