-- Database-backed rate limiting for edge functions
CREATE TABLE IF NOT EXISTS rate_limits (
  user_id      UUID         NOT NULL,
  action_type  TEXT         NOT NULL,
  window_start TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  request_count INTEGER     NOT NULL DEFAULT 1,
  PRIMARY KEY (user_id, action_type)
);

-- Index for cleanup of old entries
CREATE INDEX IF NOT EXISTS rate_limits_window_idx ON rate_limits (window_start);

-- Check and update rate limit atomically
-- Returns TRUE if request is allowed, FALSE if rate limited
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

-- Cleanup old rate limit entries (run periodically via cron or manual cleanup)
CREATE OR REPLACE FUNCTION cleanup_rate_limits(p_older_than_hours INTEGER DEFAULT 24)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_deleted INTEGER;
BEGIN
  DELETE FROM rate_limits
  WHERE window_start < NOW() - (p_older_than_hours || ' hours')::INTERVAL;
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$;

-- Grant execute to authenticated users (edge function uses service role, but just in case)
GRANT EXECUTE ON FUNCTION check_rate_limit(UUID, TEXT, INTEGER, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION check_rate_limit(UUID, TEXT, INTEGER, INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION cleanup_rate_limits(INTEGER) TO service_role;
