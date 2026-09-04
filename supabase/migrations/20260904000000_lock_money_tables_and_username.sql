-- Two holes left open by earlier hardening passes, both on the money path.
--
-- 1. TRUNCATE on the two tables that hold real money.
--
--    20260806000100_lock_players_writes.sql revoked the client roles' write
--    privileges on `players` and explained why holding an unreachable privilege
--    is not acceptable: "PostgREST does not expose TRUNCATE today, which is the
--    only reason that is not directly exploitable — not a property worth
--    depending on." That reasoning applies at least as strongly to `user_gems`
--    and `purchases`, and neither was included in the fix.
--
--    Replaying every migration against postgres:16 leaves:
--      players    anon=r/…        authenticated=r/…
--      user_gems  anon=arwdDxt/…  authenticated=arwdDxt/…
--      purchases  anon=arwdDxt/…  authenticated=arwdDxt/…
--    and TRUNCATE is NOT gated by row-level security. Executing as the
--    `authenticated` role with an ordinary user's JWT claims, TRUNCATE
--    public.players is denied while TRUNCATE public.user_gems and TRUNCATE
--    public.purchases both succeed and empty the table — every player's paid
--    balance and the entire Stripe ledger. Because purchases.stripe_session_id
--    is the only idempotency key, losing that ledger would also let webhook
--    replays re-credit sessions that were already fulfilled.
--
--    The client only ever needs to READ its own rows here (RLS restricts which):
--    every write goes through a SECURITY DEFINER function called by the webhook
--    with the service role.
REVOKE ALL ON public.user_gems FROM anon, authenticated;
REVOKE ALL ON public.purchases FROM anon, authenticated;
GRANT SELECT ON public.user_gems TO anon, authenticated;
GRANT SELECT ON public.purchases TO anon, authenticated;

-- 2. upsert_player_profile bypasses every username rule.
--
--    20260806000200_set_player_username.sql added set_player_username, which
--    trims, requires 2-20 characters, and restricts the charset. But
--    upsert_player_profile (20260427100000) still writes COALESCE(p_username,…)
--    into the same column with no validation at all, and is granted to
--    `authenticated`. Verified against a real database: a fresh authenticated
--    user calling it stores a 508-character username containing '<script>'.
--    players.username is rendered to every other player through the leaderboard
--    view, so the validated entry point is only as good as the unvalidated one
--    sitting beside it.
--
--    Rather than duplicate the rules, the fallback name is used whenever the
--    supplied one would not survive set_player_username. Profile creation must
--    not fail on a bad name — it runs at login, before the player has ever been
--    asked for one — so this sanitises rather than raising; set_player_username
--    remains the path that reports a rejection to the player.
CREATE OR REPLACE FUNCTION upsert_player_profile(
  p_user_id  UUID,
  p_username TEXT DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_name TEXT := btrim(coalesce(p_username, ''));
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> p_user_id THEN
    RAISE EXCEPTION 'Unauthorized: cannot modify another user''s profile';
  END IF;

  -- Same rules set_player_username enforces; anything failing them falls back
  -- to the generated name instead of being stored verbatim.
  IF char_length(v_name) < 2
     OR char_length(v_name) > 20
     OR v_name !~ '^[A-Za-z0-9 _.!?-]+$' THEN
    v_name := 'Player_' || LEFT(p_user_id::text, 8);
  END IF;

  INSERT INTO public.players (user_id, username)
  VALUES (p_user_id, v_name)
  ON CONFLICT (user_id) DO NOTHING;
END;
$$;

REVOKE ALL ON FUNCTION upsert_player_profile(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION upsert_player_profile(UUID, TEXT) TO authenticated;
