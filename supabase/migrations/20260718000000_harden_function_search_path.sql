-- Security-audit hardening: pin SECURITY DEFINER search_path + drop dead RPCs.
--
-- 1) Every SECURITY DEFINER function in this schema ran with a MUTABLE
--    search_path (Supabase's `function_search_path_mutable` lint). These
--    functions reference tables unqualified (user_gems, players, rate_limits),
--    so a role able to create an object in a schema resolved ahead of `public`
--    could shadow a target table. Pin the resolver to `pg_catalog, public` for
--    all of them so name resolution can't be redirected. (The auth.uid() guard
--    itself is already schema-qualified and so was never shadowable, but the
--    unqualified table reads were the real exposure.)
--
-- 2) add_player_coins / record_player_battle are dead code — no app or edge
--    function calls them — and were only ever REVOKEd FROM public, not FROM
--    authenticated. Since Supabase's default privileges grant EXECUTE on public
--    functions to `authenticated`, they may still be directly callable, and
--    neither has an auth.uid() guard: any logged-in user could credit soft
--    currency to an arbitrary user_id. Drop them outright rather than harden a
--    function nothing uses — the smaller surface is the better fix.

-- ---------------------------------------------------------------------------
-- 1) Pin search_path on the live SECURITY DEFINER functions.
-- ---------------------------------------------------------------------------
ALTER FUNCTION public.add_user_gems(UUID, INTEGER)
  SET search_path = pg_catalog, public;

ALTER FUNCTION public.upsert_player_profile(UUID, TEXT)
  SET search_path = pg_catalog, public;

ALTER FUNCTION public.sync_battle_result(UUID, BOOLEAN, INTEGER, INTEGER, INTEGER)
  SET search_path = pg_catalog, public;

ALTER FUNCTION public.sync_player_level(UUID, INTEGER, INTEGER)
  SET search_path = pg_catalog, public;

ALTER FUNCTION public.check_rate_limit(UUID, TEXT, INTEGER, INTEGER)
  SET search_path = pg_catalog, public;

ALTER FUNCTION public.cleanup_rate_limits(INTEGER)
  SET search_path = pg_catalog, public;

-- ---------------------------------------------------------------------------
-- 2) Drop the dead, unguarded soft-currency writers.
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.add_player_coins(UUID, INTEGER);
DROP FUNCTION IF EXISTS public.record_player_battle(UUID, BOOLEAN, INTEGER);
