-- Give players a way to set their own public display name.
--
-- Before this, the only writer of players.username was upsert_player_profile,
-- which runs once on first login with ON CONFLICT DO NOTHING and took whatever
-- the client passed. The client passed the email local part
-- (App.jsx: ensurePlayerProfile(email.split('@')[0])), so jane.doe@corp.com was
-- published to the global leaderboard as "jane.doe", permanently — a real
-- privacy leak — and the in-game rename only touched local state, so it could
-- never be corrected.
--
-- The client now passes no username, so upsert_player_profile falls back to its
-- anonymous 'Player_<8 uuid chars>' default. This function is the one path that
-- changes it afterwards: caller-scoped, validated, and user-callable (unlike the
-- gem functions, this one legitimately runs as the authenticated user, so it
-- guards on auth.uid() = the row owner rather than requiring service_role).

CREATE OR REPLACE FUNCTION set_player_username(p_username TEXT)
RETURNS TEXT                     -- the stored (trimmed) name, so the client can echo it
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_name TEXT := btrim(coalesce(p_username, ''));
BEGIN
  -- A user may only rename themselves.
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Unauthorized: must be signed in to set a username';
  END IF;

  -- 2–20 chars, letters/digits/space and a small punctuation set. Rejects
  -- control chars, angle brackets and the like so a hostile name cannot carry
  -- markup into another player's leaderboard row.
  IF length(v_name) < 2 OR length(v_name) > 20 THEN
    RAISE EXCEPTION 'Username must be 2 to 20 characters';
  END IF;
  IF v_name !~ '^[A-Za-z0-9 _.!?-]+$' THEN
    RAISE EXCEPTION 'Username contains disallowed characters';
  END IF;

  -- Ensure the row exists (a returning player always has one; be defensive).
  INSERT INTO public.players (user_id, username)
  VALUES (auth.uid(), v_name)
  ON CONFLICT (user_id) DO UPDATE SET username = EXCLUDED.username;

  RETURN v_name;
END;
$$;

REVOKE EXECUTE ON FUNCTION set_player_username(TEXT) FROM public, anon;
GRANT  EXECUTE ON FUNCTION set_player_username(TEXT) TO authenticated;
