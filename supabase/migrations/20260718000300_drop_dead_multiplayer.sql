-- Remove the abandoned real-time PvP prototype's attack surface.
--
-- The shipped game is single-player vs the client-side AI. Two tables from a
-- never-shipped multiplayer mode remain in the PostgREST-exposed public schema
-- and back ZERO product functionality:
--
--   * matches — its client helpers (createMatch/joinMatch/subscribeToMatch) are
--     dead (called nowhere), but the table is authenticated-writable: the UPDATE
--     policy's `OR player_two_id IS NULL` term lets any authenticated user rewrite
--     any open lobby (evict/hijack the creator), and the INSERT policy allows
--     unbounded row creation with no rate limit (storage-spam griefing).
--   * battles — mutated only by the battle-action edge function, which no client
--     calls and the runbook never deploys. It has SELECT/UPDATE policies but no
--     INSERT policy, so under RLS no row can ever be created: dead schema.
--
-- Dropping them removes writable/griefable surface with no offsetting use. If
-- real-time PvP is built later it should get a fresh, purpose-designed schema.
-- Nothing shipped reads these tables, so no data of value is lost.

DROP TABLE IF EXISTS public.battles;
DROP TABLE IF EXISTS public.matches;
