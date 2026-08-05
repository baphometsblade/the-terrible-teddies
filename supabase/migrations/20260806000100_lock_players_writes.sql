-- Stop clients from writing their own leaderboard stats directly.
--
-- players had an RLS UPDATE policy — players_update_own (20260428000000:49) —
-- scoped to the caller's own row (auth.uid() = user_id) but NOT scoped by
-- column. RLS cannot restrict columns, so "update your own row" means update
-- ANY column of it: coins, wins, losses, level, trophies. The policy comment
-- even conceded "only non-currency fields in practice (coins/stats are written
-- exclusively by SECURITY DEFINER funcs)" — but "in practice" was the whole
-- gap. Nothing enforced it.
--
-- Every legitimate write to players already goes through a SECURITY DEFINER
-- function that runs as the table owner and bounds what it sets:
--   * upsert_player_profile  — creates the row / sets username
--   * sync_battle_result     — wins/losses/coins from a real battle result
--   * sync_player_level      — level/xp
-- The client never writes the table directly: the only src/ reference is a
-- dead own-row SELECT (fetchPlayerProfile, called nowhere). So the UPDATE
-- policy backed no product behaviour — it was pure attack surface.
--
-- Impact it left open: an authenticated user PATCHes
-- /rest/v1/players?user_id=eq.<own id> with {"wins":999999,"level":999} and
-- their forged stats surface on the public leaderboard (the leaderboard view
-- reads players as owner, so own-row SELECT tightening did not contain this).
-- Not theft of real currency — gems live in user_gems and are separately
-- guarded — but straightforward leaderboard fraud.
--
-- Fix mirrors this repo's rate_limits hardening (20260705000000): revoke the
-- write privilege from the client roles outright and drop the now-moot policy.
-- SECURITY DEFINER functions are unaffected (they run as owner, not as the
-- caller's role). SELECT is left intact.

REVOKE INSERT, UPDATE, DELETE ON public.players FROM anon, authenticated;

-- The policy only ever gated an UPDATE the client no longer holds a grant for;
-- drop it so the table's remaining policies read as the real intent
-- (SELECT own-row; all writes via SECURITY DEFINER functions).
DROP POLICY IF EXISTS "players_update_own" ON public.players;
DROP POLICY IF EXISTS "Users can update own profile" ON public.players;
