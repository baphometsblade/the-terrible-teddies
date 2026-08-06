-- Close an anon-key hole in the money path.
--
-- Every SECURITY DEFINER function that mints or moves gems guarded itself with
-- a NEGATIVE check:
--
--   IF auth.uid() IS NOT NULL THEN RAISE EXCEPTION '... server-side only'; END IF;
--
-- reasoning that a NULL auth.uid() means "the service-role webhook". It does
-- not. The `anon` role also has a NULL auth.uid(), so an anon caller sails
-- straight through the guard.
--
-- The GRANTs did not stop it either. Each function revoked EXECUTE from
-- `public` and `authenticated` but never from `anon`. Revoking PUBLIC only
-- drops the implicit grant — Supabase's default privileges hand every newly
-- created function a DIRECT EXECUTE grant to anon, and a direct grant survives
-- REVOKE ... FROM public. (This repo already knew anon needs naming explicitly
-- for tables: see `REVOKE ALL ON rate_limits FROM anon, authenticated` and
-- `REVOKE SELECT ON public.leaderboard FROM anon`. The function grants just
-- never got the same treatment.)
--
-- Net effect before this migration: the anon key — which ships in the client
-- bundle as VITE_SUPABASE_ANON_KEY and is public by design — could call
-- fulfill_gem_purchase / add_user_gems with any user id and any amount and mint
-- unlimited paid currency, and call reverse_gem_purchase to strip gems from
-- anyone. check_rate_limit and cleanup_rate_limits were reachable the same way,
-- so the checkout rate limiter could be spoofed or wiped.
--
-- Two independent fixes, so neither has to be perfect:
--   1. A POSITIVE assertion — the caller must actually be service_role (or have
--      no PostgREST request context at all, i.e. a direct server connection).
--      "Not authenticated" is no longer treated as "is the server".
--   2. Explicit REVOKE ... FROM anon on every one of them.

-- ---------------------------------------------------------------------------
-- 1. The positive check.
-- ---------------------------------------------------------------------------
-- Reads the role claim PostgREST puts on the request:
--   service_role key  -> 'service_role'  -> allowed
--   anon key          -> 'anon'          -> REJECTED (this is the hole)
--   logged-in user    -> 'authenticated' -> rejected
--   direct psql/admin -> no claims       -> allowed (genuinely server-side)
CREATE OR REPLACE FUNCTION public.is_service_role()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SET search_path = pg_catalog, public
AS $$
  SELECT coalesce(
           nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role',
           ''
         ) IN ('service_role', '');
$$;

REVOKE EXECUTE ON FUNCTION public.is_service_role() FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_service_role() TO service_role;

-- ---------------------------------------------------------------------------
-- 2. Re-guard every money function.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION add_user_gems(p_user_id UUID, p_gems INTEGER)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF NOT public.is_service_role() THEN
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

CREATE OR REPLACE FUNCTION fulfill_gem_purchase(
  p_user_id        UUID,
  p_bundle_id      TEXT,
  p_gems           INTEGER,
  p_session_id     TEXT,
  p_amount         INTEGER,
  p_payment_intent TEXT DEFAULT NULL
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_rows INTEGER;
BEGIN
  IF NOT public.is_service_role() THEN
    RAISE EXCEPTION 'fulfill_gem_purchase may only be called server-side';
  END IF;

  IF p_gems <= 0 THEN
    RAISE EXCEPTION 'Gem amount must be positive';
  END IF;

  INSERT INTO purchases (
    user_id, bundle_id, gems_granted, stripe_session_id, amount_paid, status, payment_intent
  )
  VALUES (
    p_user_id, p_bundle_id, p_gems, p_session_id, p_amount, 'completed', p_payment_intent
  )
  ON CONFLICT (stripe_session_id) DO NOTHING;

  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows = 0 THEN
    RETURN 'duplicate';
  END IF;

  INSERT INTO user_gems (user_id, gems, total_purchased)
  VALUES (p_user_id, p_gems, p_gems)
  ON CONFLICT (user_id) DO UPDATE SET
    gems            = user_gems.gems + p_gems,
    total_purchased = user_gems.total_purchased + p_gems,
    updated_at      = NOW();

  RETURN 'credited';
END;
$$;

CREATE OR REPLACE FUNCTION reverse_gem_purchase(
  p_payment_intent TEXT,
  p_reason         TEXT
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_id      UUID;
  v_user_id UUID;
  v_gems    INTEGER;
  v_status  TEXT;
BEGIN
  IF NOT public.is_service_role() THEN
    RAISE EXCEPTION 'reverse_gem_purchase may only be called server-side';
  END IF;

  SELECT id, user_id, gems_granted, status
  INTO v_id, v_user_id, v_gems, v_status
  FROM purchases
  WHERE payment_intent = p_payment_intent
  ORDER BY created_at ASC
  LIMIT 1
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN 'not_found';
  END IF;

  IF v_status <> 'completed' THEN
    RETURN 'already_reversed';
  END IF;

  UPDATE user_gems
  SET gems       = GREATEST(gems - v_gems, 0),
      updated_at = NOW()
  WHERE user_id = v_user_id;

  UPDATE purchases
  SET status = p_reason
  WHERE id = v_id;

  RETURN 'reversed';
END;
$$;

-- check_rate_limit is legitimately callable by an authenticated user (the
-- checkout edge function invokes it with the caller's own JWT), so it keeps a
-- per-user rule — but "no JWT" no longer counts as server-side. An anon caller
-- is neither service_role nor the owning user, so it is now rejected instead of
-- being able to consume or spoof any user's checkout limit.
CREATE OR REPLACE FUNCTION check_rate_limit(
  p_user_id UUID,
  p_action_type TEXT,
  p_max_requests INTEGER DEFAULT 5,
  p_window_seconds INTEGER DEFAULT 60
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_window_start TIMESTAMPTZ;
  v_count INTEGER;
  v_cutoff TIMESTAMPTZ := NOW() - (p_window_seconds || ' seconds')::INTERVAL;
BEGIN
  IF NOT public.is_service_role() AND (auth.uid() IS NULL OR auth.uid() != p_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: cannot consume another user''s rate limit';
  END IF;

  SELECT window_start, request_count INTO v_window_start, v_count
  FROM rate_limits
  WHERE user_id = p_user_id AND action_type = p_action_type
  FOR UPDATE;

  IF NOT FOUND THEN
    INSERT INTO rate_limits (user_id, action_type, window_start, request_count)
    VALUES (p_user_id, p_action_type, NOW(), 1);
    RETURN TRUE;
  END IF;

  IF v_window_start < v_cutoff THEN
    UPDATE rate_limits
    SET window_start = NOW(), request_count = 1
    WHERE user_id = p_user_id AND action_type = p_action_type;
    RETURN TRUE;
  END IF;

  IF v_count >= p_max_requests THEN
    RETURN FALSE;
  END IF;

  UPDATE rate_limits
  SET request_count = request_count + 1
  WHERE user_id = p_user_id AND action_type = p_action_type;

  RETURN TRUE;
END;
$$;

-- RETURNS INTEGER, matching 20260427000000's original signature — NOT void.
-- CREATE OR REPLACE cannot change a function's return type; Postgres raises
-- "cannot change return type of existing function" (42P13) and, because the
-- CLI runs each migration file in one transaction, the whole file rolls back.
-- Every REVOKE below would then never run, leaving the exact anon hole this
-- file exists to close — a security fix that silently no-ops. Keep the
-- original return type and hand back the delete count.
CREATE OR REPLACE FUNCTION cleanup_rate_limits(p_older_than_hours INTEGER DEFAULT 24)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_deleted INTEGER;
BEGIN
  IF NOT public.is_service_role() THEN
    RAISE EXCEPTION 'cleanup_rate_limits may only be called server-side';
  END IF;

  DELETE FROM rate_limits
  WHERE window_start < NOW() - (p_older_than_hours || ' hours')::INTERVAL;
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$;

-- ---------------------------------------------------------------------------
-- 3. Name anon explicitly. `public` alone does not remove a direct grant.
-- ---------------------------------------------------------------------------
REVOKE EXECUTE ON FUNCTION add_user_gems(UUID, INTEGER)
  FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION fulfill_gem_purchase(UUID, TEXT, INTEGER, TEXT, INTEGER, TEXT)
  FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION reverse_gem_purchase(TEXT, TEXT)
  FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION cleanup_rate_limits(INTEGER)
  FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION check_rate_limit(UUID, TEXT, INTEGER, INTEGER)
  FROM public, anon;

GRANT EXECUTE ON FUNCTION add_user_gems(UUID, INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION fulfill_gem_purchase(UUID, TEXT, INTEGER, TEXT, INTEGER, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION reverse_gem_purchase(TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION cleanup_rate_limits(INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION check_rate_limit(UUID, TEXT, INTEGER, INTEGER) TO authenticated, service_role;
