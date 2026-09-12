-- Stop the rate limiter being an unmetered row-insertion primitive.
--
-- check_rate_limit is EXECUTE-granted to `authenticated` (the checkout edge
-- function calls it with the caller's own JWT), and `p_action_type` is both
-- caller-supplied and half of rate_limits' primary key. The CASE that derives
-- the window had a single branch for 'checkout' and an ELSE handing every other
-- string the same default, so no string was ever invalid. A fresh action_type
-- therefore missed the SELECT, took the NOT FOUND branch, INSERTed a row and
-- returned TRUE — every time, with nothing counting it. The limiter throttled
-- reuse of a key and never creation of keys.
--
-- Measured against postgres:16 before this migration: as the `authenticated`
-- role with an ordinary user's JWT, 500 calls with a fresh 180-character
-- action_type each returned TRUE 500 times and left 502 rows / 392 kB behind.
-- That is ~780 bytes per call, unbounded, from one signed-in account.
--
-- Two things make it worse than it looks. Because the function is SECURITY
-- DEFINER it writes as the table owner, so this walks straight through the
-- `REVOKE ALL ON rate_limits FROM anon, authenticated` that 20260705000000
-- added specifically to stop clients writing this table. And nothing ever
-- reclaims the rows: cleanup_rate_limits exists but is invoked by no scheduler,
-- no edge function and no CI job anywhere in the repository — the only
-- references to it are assertions that it is NOT callable by anon.
--
-- The fix is to make the action a closed set. There are exactly three call
-- sites in the entire system ('checkout', 'battle_result', 'level_sync'), so an
-- unknown action is always a bug or an attack, and each user is now bounded at
-- three rows. Raising rather than returning FALSE is deliberate: a new call
-- site that forgets to register its action fails loudly in development instead
-- of silently sharing another action's budget.
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
  v_max     INTEGER;
  v_window  INTEGER;
  v_window_start TIMESTAMPTZ;
  v_count   INTEGER;
  v_cutoff  TIMESTAMPTZ;
BEGIN
  IF NOT public.is_service_role() AND (auth.uid() IS NULL OR auth.uid() <> p_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: cannot consume another user''s rate limit';
  END IF;

  -- Server-owned limits, keyed on the action. The action must be one this
  -- system actually uses: anything else is rejected rather than defaulted, so
  -- the caller cannot mint new partitions of the rate_limits table.
  CASE p_action_type
    WHEN 'checkout'      THEN v_max := 5; v_window := 60;
    WHEN 'battle_result' THEN v_max := 5; v_window := 60;
    WHEN 'level_sync'    THEN v_max := 5; v_window := 60;
    ELSE RAISE EXCEPTION 'Unknown rate limit action: %', left(coalesce(p_action_type, '<null>'), 40);
  END CASE;

  v_cutoff := NOW() - (v_window || ' seconds')::INTERVAL;

  SELECT window_start, request_count INTO v_window_start, v_count
  FROM rate_limits
  WHERE user_id = p_user_id AND action_type = p_action_type
  FOR UPDATE;

  IF NOT FOUND THEN
    -- ON CONFLICT because SELECT ... FOR UPDATE cannot lock a row that does not
    -- exist yet: two concurrent first-calls both reach here, and without this
    -- the loser raised a unique violation instead of being counted.
    INSERT INTO rate_limits (user_id, action_type, window_start, request_count)
    VALUES (p_user_id, p_action_type, NOW(), 1)
    ON CONFLICT (user_id, action_type) DO UPDATE
      SET request_count = rate_limits.request_count + 1;
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

REVOKE EXECUTE ON FUNCTION check_rate_limit(UUID, TEXT, INTEGER, INTEGER) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION check_rate_limit(UUID, TEXT, INTEGER, INTEGER) TO authenticated, service_role;
