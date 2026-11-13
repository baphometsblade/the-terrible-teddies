-- Pub Brawl hot path: one database trip to open a move, one to peek at the
-- queue.
--
-- A move used to cost the edge function four sequential PostgREST trips
-- before it could answer: the rate check, the match load, an idempotency
-- lookup on pvp_actions, and the commit. A sync (the in-match poll) cost
-- three, loading the same match twice. Each trip through the API gateway is
-- 70-120 ms in production even when the SQL takes a millisecond, so the trips
-- were most of the ~1.1 s p50 a move took.
--
-- pvp_turn_open does the first three in one call. The commit stays its own
-- call because the engine runs in the function between the two.
-- pvp_queue_peek returns a queued player's row and, once they are matched,
-- the loaded match, so a status poll that finds a match needs no second load.
--
-- Both are service-role only, like every other pvp_ RPC: the functions call
-- them with the service key after verifying the caller's JWT.

CREATE OR REPLACE FUNCTION public.pvp_turn_open(p_uid UUID, p_match UUID, p_action UUID DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_loaded JSONB;
BEGIN
  IF p_uid IS NULL OR p_match IS NULL THEN
    RETURN pg_catalog.jsonb_build_object('ok', false, 'error', 'missing');
  END IF;
  -- Same budget and bookkeeping as before: the rate row is counted first, so
  -- a request refused as slow still counts against the window.
  IF NOT public.pvp_rate(p_uid, 'pvp_action') THEN
    RETURN pg_catalog.jsonb_build_object('ok', false, 'error', 'slow');
  END IF;
  v_loaded := public.pvp_load(p_match);
  IF NOT COALESCE((v_loaded->>'ok')::boolean, FALSE) THEN
    RETURN v_loaded;
  END IF;
  -- Whether this action id is already on the match (a retried request). The
  -- primary key (match_id, action_id) answers it from the index.
  RETURN v_loaded || pg_catalog.jsonb_build_object(
    'applied',
    p_action IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.pvp_actions WHERE match_id = p_match AND action_id = p_action
    )
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.pvp_queue_peek(p_uid UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_row JSONB;
  v_match UUID;
BEGIN
  v_row := public.pvp_queue_row(p_uid);
  v_match := NULLIF(v_row->>'match_id', '')::uuid;
  IF v_match IS NULL THEN
    RETURN v_row;
  END IF;
  RETURN v_row || pg_catalog.jsonb_build_object('match', public.pvp_load(v_match));
END;
$$;

ALTER FUNCTION public.pvp_turn_open(UUID, UUID, UUID) OWNER TO postgres;
ALTER FUNCTION public.pvp_queue_peek(UUID) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.pvp_turn_open(UUID, UUID, UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.pvp_queue_peek(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.pvp_turn_open(UUID, UUID, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.pvp_queue_peek(UUID) TO service_role;
