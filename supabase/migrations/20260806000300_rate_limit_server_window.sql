-- Stop trusting the caller for the rate-limit window.
--
-- check_rate_limit took p_max_requests / p_window_seconds and used them
-- verbatim. Those are RPC arguments, so any authenticated user could call the
-- function straight from the browser console with the app's own supabase
-- client and pass p_window_seconds => 0 (cutoff = NOW(), so the stored window
-- is always already expired and every call resets to 1) or p_max_requests =>
-- 1e9. Either makes the checkout rate limit a no-op — the limiter meant to cap
-- create-checkout-session calls no longer caps anything.
--
-- The limits are now derived server-side from the action type; the client
-- values are ignored. The parameters stay in the signature (unchanged return
-- type, so CREATE OR REPLACE is legal and the edge function keeps compiling),
-- they simply no longer influence the outcome.

CREATE OR REPLACE FUNCTION check_rate_limit(
  p_user_id UUID,
  p_action_type TEXT,
  p_max_requests INTEGER DEFAULT 5,     -- accepted for signature compatibility,
  p_window_seconds INTEGER DEFAULT 60   -- but IGNORED: limits are server-decided
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_max     INTEGER;
  v_window  INTEGER;
  v_window_start TIMESTAMPTZ;
  v_count   INTEGER;
  v_cutoff  TIMESTAMPTZ;
BEGIN
  IF NOT public.is_service_role() AND (auth.uid() IS NULL OR auth.uid() != p_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: cannot consume another user''s rate limit';
  END IF;

  -- Server-owned limits, keyed on the action. Unknown actions get the same
  -- conservative default so a new call site can't accidentally be unlimited.
  CASE p_action_type
    WHEN 'checkout' THEN v_max := 5; v_window := 60;
    ELSE                 v_max := 5; v_window := 60;
  END CASE;
  v_cutoff := NOW() - (v_window || ' seconds')::INTERVAL;

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

  IF v_count >= v_max THEN
    RETURN FALSE;
  END IF;

  UPDATE rate_limits
  SET request_count = request_count + 1
  WHERE user_id = p_user_id AND action_type = p_action_type;

  RETURN TRUE;
END;
$$;
