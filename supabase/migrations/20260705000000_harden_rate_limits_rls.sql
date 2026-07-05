-- The rate_limits table (20260427000000_rate_limiting.sql) is the only thing
-- gating create-checkout-session against Stripe-checkout spam, but it was the
-- lone public table in this schema with RLS never enabled — every other
-- table (players, purchases, user_gems, matches, battles) has it. Any
-- Supabase table without RLS is exposed as-is through PostgREST's default
-- authenticated/anon grants: a client could hit `/rest/v1/rate_limits`
-- directly and DELETE/UPDATE their own row (or read everyone else's) to reset
-- their window, completely bypassing check_rate_limit() and the rate limit
-- it's meant to enforce on real-money checkout creation.
--
-- Enable RLS with zero policies (default-deny for anon/authenticated). This
-- table only needs to be touched by check_rate_limit()/cleanup_rate_limits(),
-- both SECURITY DEFINER functions that run as their owning role and so are
-- unaffected by RLS — the same pattern already relied on for every other
-- SECURITY DEFINER function in this schema (add_user_gems, sync_battle_result,
-- etc., all read/write RLS-enabled tables just fine).
ALTER TABLE rate_limits ENABLE ROW LEVEL SECURITY;

-- Defense-in-depth: explicitly strip any default grants so direct table
-- access is blocked even if a future migration accidentally added a policy.
REVOKE ALL ON rate_limits FROM anon, authenticated;
