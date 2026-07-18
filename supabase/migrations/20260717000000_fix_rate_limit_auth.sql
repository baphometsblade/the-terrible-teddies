-- check_rate_limit was the one SECURITY DEFINER function that never got the
-- caller-identity guard 20260427100000_fix_security_definer_auth.sql applied
-- to all its siblings (upsert_player_profile, sync_battle_result,
-- sync_player_level). Its GRANT ... TO authenticated is load-bearing — the
-- create-checkout-session edge function calls it with the USER's JWT (anon
-- key + Authorization header), i.e. as the authenticated role, despite the
-- original migration's comment claiming service-role usage. That same grant
-- let any logged-in attacker call
--   rpc('check_rate_limit', { p_user_id: <victim>, p_action_type: 'checkout', ... })
-- five times a minute to keep a victim's window permanently exhausted, so the
-- victim's own real-money checkout attempts get 429'd — a cheap, sustained
-- denial of service on the purchase path (victim UUIDs are enumerable via the
-- authenticated players SELECT policy). The RLS hardening in 20260705 closed
-- the direct-table version of this; the RPC route remained open.
--
-- Guard: an authenticated caller may only consume their OWN limit. A NULL
-- auth.uid() (pure service-role invocation) is still allowed, preserving any
-- future server-side use.
CREATE OR REPLACE FUNCTION check_rate_limit(
  p_user_id UUID,
  p_action_type TEXT,
  p_max_requests INTEGER DEFAULT 5,
  p_window_seconds INTEGER DEFAULT 60
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_window_start TIMESTAMPTZ;
  v_count INTEGER;
  v_cutoff TIMESTAMPTZ := NOW() - (p_window_seconds || ' seconds')::INTERVAL;
BEGIN
  IF auth.uid() IS NOT NULL AND auth.uid() != p_user_id THEN
    RAISE EXCEPTION 'Unauthorized: cannot consume another user''s rate limit';
  END IF;

  -- Try to get existing entry
  SELECT window_start, request_count INTO v_window_start, v_count
  FROM rate_limits
  WHERE user_id = p_user_id AND action_type = p_action_type
  FOR UPDATE;

  IF NOT FOUND THEN
    -- No entry exists, create new one
    INSERT INTO rate_limits (user_id, action_type, window_start, request_count)
    VALUES (p_user_id, p_action_type, NOW(), 1);
    RETURN TRUE;
  END IF;

  IF v_window_start < v_cutoff THEN
    -- Window expired, reset
    UPDATE rate_limits
    SET window_start = NOW(), request_count = 1
    WHERE user_id = p_user_id AND action_type = p_action_type;
    RETURN TRUE;
  END IF;

  IF v_count >= p_max_requests THEN
    -- Rate limited
    RETURN FALSE;
  END IF;

  -- Increment counter
  UPDATE rate_limits
  SET request_count = request_count + 1
  WHERE user_id = p_user_id AND action_type = p_action_type;
  RETURN TRUE;
END;
$$;
