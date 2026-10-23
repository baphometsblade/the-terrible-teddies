#!/usr/bin/env bash
# Replay every migration against a real PostgreSQL, in filename order, exactly
# as `supabase db push` would — then assert the security properties actually
# hold on the resulting schema.
#
# This exists because a migration that PostgreSQL refuses to apply is invisible
# to every other gate. Lint, vitest and playwright never execute SQL. A security
# migration once shipped with `CREATE OR REPLACE FUNCTION ... RETURNS void` over
# a function previously declared `RETURNS INTEGER`; Postgres rejected it (42P13),
# the CLI's per-file transaction rolled the whole thing back, and the REVOKEs
# that were the entire point of the file silently never ran. All 258 unit tests
# and 35 e2e tests passed against that build.
#
# Usage:  DATABASE_URL=postgres://... scripts/check-migrations.sh
# In CI the postgres service container supplies DATABASE_URL.
set -euo pipefail

DB="${DATABASE_URL:?set DATABASE_URL to a scratch PostgreSQL, e.g. postgres://postgres:postgres@localhost:5432/postgres}"
PSQL=(psql "$DB" -v ON_ERROR_STOP=1 -q)

echo "==> Scaffolding Supabase-shaped prerequisites"
"${PSQL[@]}" <<'SQL'
DO $$ BEGIN
  CREATE ROLE anon NOLOGIN;          EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE ROLE authenticated NOLOGIN; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE ROLE service_role NOLOGIN;  EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE SCHEMA IF NOT EXISTS auth;
CREATE TABLE IF NOT EXISTS auth.users (id UUID PRIMARY KEY, email TEXT);

-- Supabase's helpers, reading the same request GUC PostgREST sets.
CREATE OR REPLACE FUNCTION auth.uid() RETURNS UUID LANGUAGE sql STABLE AS $fn$
  SELECT nullif(coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub', ''), '')::uuid
$fn$;
CREATE OR REPLACE FUNCTION auth.role() RETURNS TEXT LANGUAGE sql STABLE AS $fn$
  SELECT coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role', '')
$fn$;

GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

-- The bootstrap line that makes the anon-grant problem real: every newly
-- created function gets a DIRECT execute grant to anon, which a
-- REVOKE ... FROM public does NOT remove.
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO postgres, anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES    TO postgres, anon, authenticated, service_role;

-- `players` predates the migration history (it was created outside migrations),
-- so migrations that ALTER it assume it exists. Create it here so the chain can
-- be replayed from empty.
CREATE TABLE IF NOT EXISTS public.players (
  user_id  UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT,
  coins    INTEGER DEFAULT 0,
  wins     INTEGER DEFAULT 0,
  losses   INTEGER DEFAULT 0,
  level    INTEGER DEFAULT 1,
  xp       INTEGER DEFAULT 0,
  trophies INTEGER DEFAULT 0
);

-- Pre-migration fixture rows for the username-backfill assertion below: one
-- account whose stored name is its email local part (the pre-bba1f55 leak),
-- one whose name was deliberately customized after the fix. The backfill
-- migration must scrub the first and MUST NOT touch the second — the
-- over-broad "WHERE username IS NOT NULL" variant destroyed every custom name.
INSERT INTO auth.users (id, email) VALUES
  ('22222222-2222-4222-8222-222222222222', 'a.smith@corp.example'),
  ('33333333-3333-4333-8333-333333333333', 'bob@mail.example')
ON CONFLICT DO NOTHING;
INSERT INTO public.players (user_id, username) VALUES
  ('22222222-2222-4222-8222-222222222222', 'a.smith'),
  ('33333333-3333-4333-8333-333333333333', 'DreadBear')
ON CONFLICT DO NOTHING;
SQL

echo "==> Applying migrations in filename order"
for f in supabase/migrations/*.sql; do
  # --single-transaction mirrors the CLI: any statement error rolls back the
  # whole file, so a partial apply can never look like a success.
  if psql "$DB" -v ON_ERROR_STOP=1 -q --single-transaction -f "$f" >/dev/null 2>/tmp/mig_err; then
    echo "    ok   $(basename "$f")"
  else
    echo "    FAIL $(basename "$f")"
    sed 's/^/         /' /tmp/mig_err
    exit 1
  fi
done

echo "==> Asserting security properties on the resulting schema"
"${PSQL[@]}" <<'SQL'
DO $$
DECLARE
  fn   TEXT;
  bad  TEXT := '';
BEGIN
  -- No money-path function may be executable by anon.
  FOR fn IN SELECT unnest(ARRAY['add_user_gems','fulfill_gem_purchase','reverse_gem_purchase','restore_gem_purchase','cleanup_rate_limits'])
  LOOP
    IF EXISTS (
      SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.proname = fn
        AND has_function_privilege('anon', p.oid, 'EXECUTE')
    ) THEN bad := bad || format('  anon can EXECUTE %s%s', fn, chr(10)); END IF;
  END LOOP;

  -- The positive service-role assertion must exist.
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'is_service_role'
  ) THEN bad := bad || '  is_service_role() was never created' || chr(10); END IF;

  -- Clients must not hold any write privilege on ANY of the three tables that
  -- carry player state or money. This used to check `players` alone, and the
  -- two tables holding real money were the ones left out: user_gems and
  -- purchases still granted anon and authenticated the full arwdDxt set.
  -- TRUNCATE is not gated by row-level security, so `TRUNCATE public.user_gems`
  -- executed as `authenticated` with an ordinary JWT emptied the table — every
  -- player's paid balance — while the same statement against `players` was
  -- correctly denied. Loop, so adding a table cannot silently skip this.
  FOR fn IN SELECT unnest(ARRAY['players','user_gems','purchases'])
  LOOP
    IF EXISTS (
      SELECT 1 FROM information_schema.role_table_grants
      WHERE table_name = fn AND grantee IN ('anon','authenticated')
        AND privilege_type IN ('INSERT','UPDATE','DELETE','TRUNCATE')
    ) THEN bad := bad || format('  anon/authenticated still hold a write grant on %s%s', fn, chr(10)); END IF;
  END LOOP;

  -- set_player_username is a user-callable rename: authenticated may execute it,
  -- anon may not (an unauthenticated caller must not be able to set names).
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'set_player_username'
      AND has_function_privilege('authenticated', p.oid, 'EXECUTE')
  ) THEN bad := bad || '  authenticated cannot EXECUTE set_player_username' || chr(10); END IF;
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'set_player_username'
      AND has_function_privilege('anon', p.oid, 'EXECUTE')
  ) THEN bad := bad || '  anon can EXECUTE set_player_username' || chr(10); END IF;

  IF bad <> '' THEN
    RAISE EXCEPTION E'Security assertions FAILED:\n%', bad;
  END IF;
  RAISE NOTICE 'security assertions passed';
END $$;
SQL

echo "==> Asserting leaderboard-integrity BEHAVIOUR (not just grants)"
"${PSQL[@]}" <<'SQL'
DO $$
DECLARE
  uid   UUID := '11111111-1111-4111-8111-111111111111';
  v_exp INTEGER;
  v_wins INTEGER;
BEGIN
  INSERT INTO auth.users (id, email) VALUES (uid, 'jane.doe@example.com') ON CONFLICT DO NOTHING;
  INSERT INTO public.players (user_id) VALUES (uid) ON CONFLICT DO NOTHING;
  -- Impersonate the authenticated caller so auth.uid() = uid inside the RPCs.
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', uid::text, 'role', 'authenticated')::text, true);

  -- (1) The experience fraud must fail BOTH ways: a single huge sync must not
  --     set the raw client value, and a rapid LOOP of capped syncs must be
  --     rate-limited — the +200/call cap alone just converts the one-call
  --     exploit into a 50-iteration console loop. With the server default of
  --     5 calls/window, six rapid syncs may apply at most five increases.
  PERFORM public.sync_player_level(uid, 100, 10000);
  SELECT experience INTO v_exp FROM public.players WHERE user_id = uid;
  IF v_exp > 200 THEN
    RAISE EXCEPTION 'sync_player_level did NOT cap the experience increase: got %', v_exp;
  END IF;
  PERFORM public.sync_player_level(uid, 100, 10000);
  PERFORM public.sync_player_level(uid, 100, 10000);
  PERFORM public.sync_player_level(uid, 100, 10000);
  PERFORM public.sync_player_level(uid, 100, 10000);
  PERFORM public.sync_player_level(uid, 100, 10000); -- 6th call in the window
  SELECT experience INTO v_exp FROM public.players WHERE user_id = uid;
  IF v_exp > 1000 THEN
    RAISE EXCEPTION 'sync_player_level is NOT rate-limited: a rapid loop reached experience %', v_exp;
  END IF;

  -- (2) Rapid battle syncs must be rate-limited: with the server default of
  --     5 per window, the 6th win in one window must not land.
  PERFORM public.sync_battle_result(uid, true, 0, 0, 0);
  PERFORM public.sync_battle_result(uid, true, 0, 0, 0);
  PERFORM public.sync_battle_result(uid, true, 0, 0, 0);
  PERFORM public.sync_battle_result(uid, true, 0, 0, 0);
  PERFORM public.sync_battle_result(uid, true, 0, 0, 0);
  PERFORM public.sync_battle_result(uid, true, 0, 0, 0);
  SELECT wins INTO v_wins FROM public.players WHERE user_id = uid;
  IF v_wins <> 5 THEN
    RAISE EXCEPTION 'sync_battle_result is NOT rate-limited: expected 5 wins, got %', v_wins;
  END IF;

  -- (3) The username backfill must be TARGETED. The scaffold seeded two rows
  --     before migrations ran: an email-derived name (the leak) and a
  --     deliberately customized one. The backfill must scrub only the first —
  --     the over-broad "WHERE username IS NOT NULL" variant renamed every
  --     custom name in the game.
  IF EXISTS (
    SELECT 1 FROM public.players
    WHERE user_id = '22222222-2222-4222-8222-222222222222' AND username = 'a.smith'
  ) THEN
    RAISE EXCEPTION 'username backfill left the email-derived name "a.smith" published';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.players
    WHERE user_id = '33333333-3333-4333-8333-333333333333' AND username = 'DreadBear'
  ) THEN
    RAISE EXCEPTION 'username backfill destroyed a deliberately-set name (DreadBear) — it must scrub only email-derived names';
  END IF;

  RAISE NOTICE 'leaderboard-integrity behavioural assertions passed';
END $$;
SQL

echo "==> Asserting TRUNCATE is actually denied, and usernames are sanitised"
"${PSQL[@]}" <<'SQL'
-- Grants are the mechanism; these are the behaviours they are supposed to buy.
-- Asserted by EXECUTING as the client role, because that is what an attacker
-- does — a grant table read the way you expect can still be wrong.
DO $$
DECLARE
  t        TEXT;
  ok       BOOLEAN;
  v_name   TEXT;
  v_user   UUID := '99999999-9999-4999-8999-999999999999';
BEGIN
  FOR t IN SELECT unnest(ARRAY['players','user_gems','purchases'])
  LOOP
    ok := FALSE;
    BEGIN
      EXECUTE format('SET LOCAL ROLE authenticated');
      EXECUTE format('TRUNCATE public.%I', t);
    EXCEPTION WHEN insufficient_privilege THEN
      ok := TRUE;
    END;
    RESET ROLE;
    IF NOT ok THEN
      RAISE EXCEPTION 'authenticated could TRUNCATE public.% — RLS does not gate TRUNCATE', t;
    END IF;
  END LOOP;

  -- upsert_player_profile must not be a way around set_player_username's rules.
  INSERT INTO auth.users(id) VALUES (v_user) ON CONFLICT DO NOTHING;
  PERFORM set_config('request.jwt.claims',
    format('{"sub":"%s","role":"authenticated"}', v_user), TRUE);
  PERFORM upsert_player_profile(v_user, repeat('A', 500) || '<script>');
  SELECT username INTO v_name FROM public.players WHERE user_id = v_user;
  IF v_name IS NULL OR char_length(v_name) > 20 OR v_name !~ '^[A-Za-z0-9 _.!?-]+$' THEN
    RAISE EXCEPTION 'upsert_player_profile stored an unvalidated username: %', left(coalesce(v_name,'<null>'), 40);
  END IF;

  -- ...while still keeping a name that WOULD pass set_player_username.
  DELETE FROM public.players WHERE user_id = v_user;
  PERFORM upsert_player_profile(v_user, 'Grizzly Pete');
  SELECT username INTO v_name FROM public.players WHERE user_id = v_user;
  IF v_name <> 'Grizzly Pete' THEN
    RAISE EXCEPTION 'upsert_player_profile mangled a legitimate username: %', v_name;
  END IF;

  RAISE NOTICE 'truncate/username assertions passed';
END $$;
SQL

echo "==> Asserting the reversal round-trip (reverse -> restore) behaves"
"${PSQL[@]}" <<'SQL'
-- restore_gem_purchase exists because reverse_gem_purchase is one-way, and the
-- webhook calls it on every charge.dispute.created — including inquiries, where
-- Stripe withdraws nothing. These assert the money actually comes back, exactly
-- once, and that the function cannot be used to mint gems.
DO $$
DECLARE
  v_user UUID := 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  v_pi   TEXT := 'pi_check_restore';
  v_out  TEXT;
  v_gems INTEGER;
BEGIN
  INSERT INTO auth.users(id) VALUES (v_user) ON CONFLICT DO NOTHING;
  INSERT INTO purchases(user_id, stripe_session_id, payment_intent, bundle_id,
                        gems_granted, amount_paid, status)
  VALUES (v_user, 'cs_check_restore', v_pi, 'gems_large', 500, 999, 'completed');
  INSERT INTO user_gems(user_id, gems, total_purchased) VALUES (v_user, 500, 500)
    ON CONFLICT (user_id) DO UPDATE SET gems = 500;

  PERFORM reverse_gem_purchase(v_pi, 'disputed');
  SELECT gems INTO v_gems FROM user_gems WHERE user_id = v_user;
  IF v_gems <> 0 THEN RAISE EXCEPTION 'reverse_gem_purchase did not debit (gems=%)', v_gems; END IF;

  SELECT restore_gem_purchase(v_pi) INTO v_out;
  SELECT gems INTO v_gems FROM user_gems WHERE user_id = v_user;
  IF v_out <> 'restored' OR v_gems <> 500 THEN
    RAISE EXCEPTION 'restore did not put the gems back (out=%, gems=%)', v_out, v_gems;
  END IF;

  -- Idempotent: a replayed webhook must not credit twice.
  SELECT restore_gem_purchase(v_pi) INTO v_out;
  SELECT gems INTO v_gems FROM user_gems WHERE user_id = v_user;
  IF v_out <> 'not_reversed' OR v_gems <> 500 THEN
    RAISE EXCEPTION 'restore was not idempotent (out=%, gems=%)', v_out, v_gems;
  END IF;

  -- Cannot mint gems for a purchase that does not exist.
  SELECT restore_gem_purchase('pi_no_such_intent') INTO v_out;
  IF v_out <> 'not_found' THEN RAISE EXCEPTION 'unknown payment_intent not rejected (%)', v_out; END IF;

  -- A REFUND must never be restorable. Refund and dispute are not symmetric:
  -- a won dispute returns the funds, a refund is money we gave back on purpose.
  -- Stripe allows both on one charge, and the webhook keys restore only on
  -- payment_intent, so without this a refunded customer who also disputed would
  -- keep the money AND the gems.
  INSERT INTO purchases(user_id, stripe_session_id, payment_intent, bundle_id,
                        gems_granted, amount_paid, status)
  VALUES (v_user, 'cs_check_refund', 'pi_check_refund', 'gems_large', 500, 999, 'completed');
  UPDATE user_gems SET gems = 500 WHERE user_id = v_user;

  PERFORM reverse_gem_purchase('pi_check_refund', 'refunded');
  SELECT gems INTO v_gems FROM user_gems WHERE user_id = v_user;
  IF v_gems <> 0 THEN RAISE EXCEPTION 'refund did not debit (gems=%)', v_gems; END IF;

  SELECT restore_gem_purchase('pi_check_refund') INTO v_out;
  SELECT gems INTO v_gems FROM user_gems WHERE user_id = v_user;
  IF v_out <> 'not_reversed' OR v_gems <> 0 THEN
    RAISE EXCEPTION 'a REFUNDED purchase was restorable (out=%, gems=%)', v_out, v_gems;
  END IF;

  -- The rate limiter must not be an unmetered INSERT primitive. action_type is
  -- half the primary key AND caller-supplied, so before this was closed to a
  -- known set, every fresh string minted a permanent row and returned TRUE —
  -- 500 calls, 500 rows, from one signed-in account, straight through the
  -- REVOKE on rate_limits because the function is SECURITY DEFINER.
  DECLARE
    v_rows_before INT;
    v_rows_after  INT;
    v_rejected    BOOLEAN := FALSE;
  BEGIN
    SELECT count(*) INTO v_rows_before FROM rate_limits;
    BEGIN
      PERFORM check_rate_limit(v_user, 'definitely-not-a-real-action');
    EXCEPTION WHEN OTHERS THEN
      v_rejected := TRUE;
    END;
    SELECT count(*) INTO v_rows_after FROM rate_limits;
    IF NOT v_rejected THEN
      RAISE EXCEPTION 'check_rate_limit accepted an unknown action_type';
    END IF;
    IF v_rows_after <> v_rows_before THEN
      RAISE EXCEPTION 'an unknown action_type still wrote % rate_limits row(s)', v_rows_after - v_rows_before;
    END IF;
    -- ...while the three real actions still work.
    IF NOT (check_rate_limit(v_user, 'checkout')
        AND check_rate_limit(v_user, 'battle_result')
        AND check_rate_limit(v_user, 'level_sync')) THEN
      RAISE EXCEPTION 'a legitimate rate-limit action was rejected';
    END IF;
  END;

  RAISE NOTICE 'reversal round-trip assertions passed';
END $$;
SQL

echo "==> Asserting a buyer reads exactly their own purchases (one-per-account check)"
"${PSQL[@]}" <<'SQL'
-- create-checkout-session refuses a second Starter Gem Pack by reading the
-- buyer's purchases with the buyer's own JWT, and the Shop reads the same rows
-- to show the offer as claimed. Both lean on purchases_select_own. If that
-- policy were dropped with RLS left on, the read would return nothing rather
-- than fail, and the check would quietly sell the pack again — so assert what
-- the authenticated role actually sees.
DO $$
DECLARE
  v_buyer UUID := 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
  v_other UUID := 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
  v_mine  INTEGER;
  v_theirs INTEGER;
BEGIN
  INSERT INTO auth.users(id) VALUES (v_buyer), (v_other) ON CONFLICT DO NOTHING;
  INSERT INTO purchases(user_id, stripe_session_id, bundle_id, gems_granted, amount_paid, status)
  VALUES (v_buyer, 'cs_check_starter_buyer', 'starter_bundle', 300, 499, 'completed'),
         (v_other, 'cs_check_starter_other', 'starter_bundle', 300, 499, 'completed');

  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', v_buyer::text, 'role', 'authenticated')::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  SELECT count(*) INTO v_mine FROM public.purchases
    WHERE user_id = v_buyer AND bundle_id = 'starter_bundle' AND status = 'completed';
  SELECT count(*) INTO v_theirs FROM public.purchases WHERE user_id = v_other;
  RESET ROLE;

  IF v_mine <> 1 THEN
    RAISE EXCEPTION 'an authenticated buyer cannot read their own completed starter_bundle (saw % rows)', v_mine;
  END IF;
  IF v_theirs <> 0 THEN
    RAISE EXCEPTION 'an authenticated buyer can read another account''s purchases (saw % rows)', v_theirs;
  END IF;
  RAISE NOTICE 'own-purchases read assertions passed';
END $$;
SQL

# ----------------------------------------------------------------------------
# Cloud saves and server-side rank (20261023000000_cloud_saves_and_rank.sql).
# Three blocks: what the grants say, what a signed-in client can actually do
# with them, and what the board and the rank actually return.
# ----------------------------------------------------------------------------
echo "==> Asserting cloud-save and rank grants (player_saves, its RPCs, the trophy board)"
"${PSQL[@]}" <<'SQL'
DO $$
DECLARE
  fn  TEXT;
  bad TEXT := '';
BEGIN
  IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.player_saves'::regclass) THEN
    bad := bad || '  RLS is not enabled on player_saves' || chr(10);
  END IF;
  -- No client role holds ANY privilege on the table: every read and write
  -- goes through the definer functions, and TRUNCATE is not gated by RLS.
  FOR fn IN SELECT unnest(ARRAY['anon','authenticated'])
  LOOP
    IF has_table_privilege(fn, 'public.player_saves',
         'SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER') THEN
      bad := bad || format('  %s holds a privilege on player_saves%s', fn, chr(10));
    END IF;
  END LOOP;

  -- Each RPC: definer rights, a pinned search_path, callable by a signed-in
  -- player and not by the anon key.
  FOR fn IN SELECT unnest(ARRAY['get_player_save','put_player_save','get_my_rank'])
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.proname = fn AND p.prosecdef
        AND EXISTS (SELECT 1 FROM unnest(p.proconfig) c WHERE c LIKE 'search_path=%')
    ) THEN bad := bad || format('  %s is not SECURITY DEFINER with a pinned search_path%s', fn, chr(10)); END IF;
    IF EXISTS (
      SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.proname = fn AND has_function_privilege('anon', p.oid, 'EXECUTE')
    ) THEN bad := bad || format('  anon can EXECUTE %s%s', fn, chr(10)); END IF;
    IF NOT EXISTS (
      SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.proname = fn AND has_function_privilege('authenticated', p.oid, 'EXECUTE')
    ) THEN bad := bad || format('  authenticated cannot EXECUTE %s%s', fn, chr(10)); END IF;
  END LOOP;

  -- The trophy board is read-only for a signed-in player and closed to anon.
  IF has_table_privilege('anon', 'public.leaderboard_trophies', 'SELECT') THEN
    bad := bad || '  anon can SELECT leaderboard_trophies' || chr(10);
  END IF;
  IF NOT has_table_privilege('authenticated', 'public.leaderboard_trophies', 'SELECT') THEN
    bad := bad || '  authenticated cannot SELECT leaderboard_trophies' || chr(10);
  END IF;
  IF has_table_privilege('authenticated', 'public.leaderboard_trophies', 'INSERT, UPDATE, DELETE, TRUNCATE') THEN
    bad := bad || '  authenticated holds a write privilege on leaderboard_trophies' || chr(10);
  END IF;

  IF bad <> '' THEN
    RAISE EXCEPTION E'Cloud-save/rank grant assertions FAILED:\n%', bad;
  END IF;
  RAISE NOTICE 'cloud-save and rank grant assertions passed';
END $$;
SQL

echo "==> Asserting cloud-save BEHAVIOUR as the client roles (own row only, compare-and-swap, size cap)"
"${PSQL[@]}" <<'SQL'
DO $$
DECLARE
  v_a  UUID := 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1';
  v_b  UUID := 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee2';
  r    JSONB;
  ok   BOOLEAN;
  v_rev BIGINT;
  v_save JSONB;
BEGIN
  INSERT INTO auth.users(id) VALUES (v_a), (v_b) ON CONFLICT DO NOTHING;

  -- Player A, signed in.
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', v_a::text, 'role', 'authenticated')::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';

  r := public.get_player_save();
  IF (r->>'rev')::BIGINT <> 0 OR jsonb_typeof(r->'save') <> 'null' THEN
    RAISE EXCEPTION 'a player with no save did not read rev 0 and a null save: %', r;
  END IF;

  -- The first save needs base 0 and lands as rev 1.
  r := public.put_player_save('{"level": 3}'::jsonb, 0);
  IF NOT (r->>'ok')::BOOLEAN OR (r->>'rev')::BIGINT <> 1 THEN
    RAISE EXCEPTION 'the first save (base 0) was not accepted as rev 1: %', r;
  END IF;

  -- A second "first save" is a conflict: it reports rev 1 and writes nothing.
  r := public.put_player_save('{"level": 99}'::jsonb, 0);
  IF (r->>'ok')::BOOLEAN OR (r->>'rev')::BIGINT <> 1 THEN
    RAISE EXCEPTION 'a base-0 write over an existing save was not refused with the current rev: %', r;
  END IF;
  r := public.get_player_save();
  IF r->'save'->>'level' <> '3' THEN
    RAISE EXCEPTION 'a refused base-0 write still changed the save: %', r;
  END IF;

  -- In step: base 1 lands as rev 2.
  r := public.put_player_save('{"level": 4}'::jsonb, 1);
  IF NOT (r->>'ok')::BOOLEAN OR (r->>'rev')::BIGINT <> 2 THEN
    RAISE EXCEPTION 'a write from the current rev was not accepted: %', r;
  END IF;

  -- Stale: base 1 again, now that the save is at 2. Refused, reporting 2.
  r := public.put_player_save('{"level": 5}'::jsonb, 1);
  IF (r->>'ok')::BOOLEAN OR (r->>'rev')::BIGINT <> 2 THEN
    RAISE EXCEPTION 'a write from a stale rev was not refused with the current rev: %', r;
  END IF;
  r := public.get_player_save();
  IF r->'save'->>'level' <> '4' OR (r->>'rev')::BIGINT <> 2 THEN
    RAISE EXCEPTION 'a refused stale write changed the save: %', r;
  END IF;

  -- The size cap: over 64 KiB is refused with PT413 (HTTP 413) and changes
  -- nothing; just under it is accepted.
  ok := FALSE;
  BEGIN
    PERFORM public.put_player_save(jsonb_build_object('blob', repeat('x', 70000)), 2);
  EXCEPTION WHEN SQLSTATE 'PT413' THEN
    ok := TRUE;
  END;
  IF NOT ok THEN RAISE EXCEPTION 'a save over the size cap was not refused with PT413'; END IF;
  r := public.get_player_save();
  IF (r->>'rev')::BIGINT <> 2 THEN RAISE EXCEPTION 'an oversized save still moved the rev: %', r->>'rev'; END IF;
  r := public.put_player_save(jsonb_build_object('level', 6, 'blob', repeat('x', 60000)), 2);
  IF NOT (r->>'ok')::BOOLEAN OR (r->>'rev')::BIGINT <> 3 THEN
    RAISE EXCEPTION 'a save under the size cap was refused: %', r->>'rev';
  END IF;

  -- Only an object is a save.
  ok := FALSE;
  BEGIN
    PERFORM public.put_player_save('[1, 2, 3]'::jsonb, 3);
  EXCEPTION WHEN SQLSTATE '22023' THEN
    ok := TRUE;
  END;
  IF NOT ok THEN RAISE EXCEPTION 'a non-object save was accepted'; END IF;

  -- The table itself is out of reach, read or write.
  ok := FALSE;
  BEGIN PERFORM 1 FROM public.player_saves; EXCEPTION WHEN insufficient_privilege THEN ok := TRUE; END;
  IF NOT ok THEN RAISE EXCEPTION 'authenticated can SELECT player_saves directly'; END IF;
  ok := FALSE;
  BEGIN UPDATE public.player_saves SET rev = rev + 100; EXCEPTION WHEN insufficient_privilege THEN ok := TRUE; END;
  IF NOT ok THEN RAISE EXCEPTION 'authenticated can UPDATE player_saves directly'; END IF;
  ok := FALSE;
  BEGIN TRUNCATE public.player_saves; EXCEPTION WHEN insufficient_privilege THEN ok := TRUE; END;
  IF NOT ok THEN RAISE EXCEPTION 'authenticated can TRUNCATE player_saves'; END IF;

  -- Player B: sees no save (not A's), and a write carrying A's rev only ever
  -- reaches B's own (empty) row, so it is refused and A's save is untouched.
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', v_b::text, 'role', 'authenticated')::text, true);
  r := public.get_player_save();
  IF (r->>'rev')::BIGINT <> 0 OR jsonb_typeof(r->'save') <> 'null' THEN
    RAISE EXCEPTION 'player B could read player A''s save: %', left(r::text, 80);
  END IF;
  r := public.put_player_save('{"level": 1, "who": "B"}'::jsonb, 3);
  IF (r->>'ok')::BOOLEAN OR (r->>'rev')::BIGINT <> 0 THEN
    RAISE EXCEPTION 'player B''s write with A''s rev was not refused against B''s own row: %', r;
  END IF;
  r := public.put_player_save('{"level": 1, "who": "B"}'::jsonb, 0);
  IF NOT (r->>'ok')::BOOLEAN OR (r->>'rev')::BIGINT <> 1 THEN
    RAISE EXCEPTION 'player B''s first save was not accepted: %', r;
  END IF;
  RESET ROLE;

  SELECT rev, save INTO v_rev, v_save FROM public.player_saves WHERE user_id = v_a;
  IF v_rev <> 3 OR v_save->>'level' <> '6' OR v_save ? 'who' THEN
    RAISE EXCEPTION 'player A''s save was changed by player B (rev %, level %)', v_rev, v_save->>'level';
  END IF;
  IF (SELECT count(*) FROM public.player_saves WHERE user_id IN (v_a, v_b)) <> 2 THEN
    RAISE EXCEPTION 'expected exactly one save row each for A and B';
  END IF;

  -- The anon key reaches none of it.
  PERFORM set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
  EXECUTE 'SET LOCAL ROLE anon';
  ok := FALSE;
  BEGIN PERFORM public.get_player_save(); EXCEPTION WHEN insufficient_privilege THEN ok := TRUE; END;
  IF NOT ok THEN RAISE EXCEPTION 'anon can call get_player_save'; END IF;
  ok := FALSE;
  BEGIN PERFORM public.put_player_save('{}'::jsonb, 0); EXCEPTION WHEN insufficient_privilege THEN ok := TRUE; END;
  IF NOT ok THEN RAISE EXCEPTION 'anon can call put_player_save'; END IF;
  ok := FALSE;
  BEGIN PERFORM * FROM public.get_my_rank(); EXCEPTION WHEN insufficient_privilege THEN ok := TRUE; END;
  IF NOT ok THEN RAISE EXCEPTION 'anon can call get_my_rank'; END IF;
  ok := FALSE;
  BEGIN PERFORM 1 FROM public.leaderboard_trophies; EXCEPTION WHEN insufficient_privilege THEN ok := TRUE; END;
  IF NOT ok THEN RAISE EXCEPTION 'anon can read leaderboard_trophies'; END IF;
  RESET ROLE;

  RAISE NOTICE 'cloud-save behavioural assertions passed';
END $$;
SQL

echo "==> Asserting trophies and rank BEHAVIOUR (the client's formula, trophy order, ties share a place)"
"${PSQL[@]}" <<'SQL'
DO $$
DECLARE
  v_x UUID := 'ffffffff-ffff-4fff-8fff-fffffffffff1';
  v_y UUID := 'ffffffff-ffff-4fff-8fff-fffffffffff2';
  v_z UUID := 'ffffffff-ffff-4fff-8fff-fffffffffff3';
  v_none UUID := 'ffffffff-ffff-4fff-8fff-fffffffffff4';
  v_rank BIGINT;
  v_trophies INTEGER;
  v_n INTEGER;
  v_bad INTEGER;
  v_top TEXT;
BEGIN
  -- The same fixture Leaderboard.test.jsx runs calculateTrophies over:
  -- (wins, experience, best streak) -> trophies.
  IF public.player_trophies(0, 0, 0) <> 10
     OR public.player_trophies(NULL, NULL, NULL) <> 10
     OR public.player_trophies(3, 250, 2) <> 64
     OR public.player_trophies(10, 99, 0) <> 90
     OR public.player_trophies(10, 100, 0) <> 100
     OR public.player_trophies(5, -50, 1) <> 55
     OR public.player_trophies(0, -150, 0) <> 10
     OR public.player_trophies(120, 4321, 9) <> 1445 THEN
    RAISE EXCEPTION 'player_trophies does not match the client''s calculateTrophies fixture';
  END IF;

  -- Three players far above everyone the earlier blocks created: X and Y
  -- tied, Z one win behind.
  INSERT INTO auth.users(id) VALUES (v_x), (v_y), (v_z), (v_none) ON CONFLICT DO NOTHING;
  INSERT INTO public.players (user_id, username, wins, experience, best_win_streak) VALUES
    (v_x, 'RankX', 5000, 0, 0),
    (v_y, 'RankY', 5000, 0, 0),
    (v_z, 'RankZ', 4999, 0, 0)
  ON CONFLICT (user_id) DO UPDATE SET
    username = EXCLUDED.username, wins = EXCLUDED.wins,
    experience = EXCLUDED.experience, best_win_streak = EXCLUDED.best_win_streak;

  -- The board comes out in trophy order, and each row's rank is the count
  -- get_my_rank makes: 1 + every player with strictly more trophies. Counted
  -- here with the owner's rights, because RLS limits a client's own read of
  -- players to its own row (the view and get_my_rank run as definer).
  SELECT count(*) INTO v_bad FROM (
    SELECT trophies, lag(trophies) OVER (ORDER BY pos) AS prev
    FROM (SELECT row_number() OVER () AS pos, trophies FROM public.leaderboard_trophies) s
  ) o WHERE prev IS NOT NULL AND trophies > prev;
  IF v_bad <> 0 THEN RAISE EXCEPTION 'leaderboard_trophies is not in trophy order (% rows out of place)', v_bad; END IF;

  SELECT count(*) INTO v_bad FROM public.leaderboard_trophies b
  WHERE b.rank <> 1 + (SELECT count(*) FROM public.players o
                       WHERE public.player_trophies(o.wins, o.experience, o.best_win_streak) > b.trophies);
  IF v_bad <> 0 THEN RAISE EXCEPTION 'leaderboard_trophies ranks % row(s) differently from get_my_rank''s count', v_bad; END IF;

  EXECUTE 'SET LOCAL ROLE authenticated';

  -- Ties share a place: X and Y are both #1, so Z is #3, not #2.
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_x::text, 'role', 'authenticated')::text, true);
  SELECT r.rank, r.trophies INTO v_rank, v_trophies FROM public.get_my_rank() r;
  IF v_rank <> 1 OR v_trophies <> 40010 THEN
    RAISE EXCEPTION 'get_my_rank for the top player: rank %, trophies % (expected 1, 40010)', v_rank, v_trophies;
  END IF;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_y::text, 'role', 'authenticated')::text, true);
  SELECT r.rank INTO v_rank FROM public.get_my_rank() r;
  IF v_rank <> 1 THEN RAISE EXCEPTION 'a tie for first did not share rank 1 (got %)', v_rank; END IF;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_z::text, 'role', 'authenticated')::text, true);
  SELECT r.rank INTO v_rank FROM public.get_my_rank() r;
  IF v_rank <> 3 THEN RAISE EXCEPTION 'get_my_rank is not 1 + players with strictly more trophies (got %, expected 3)', v_rank; END IF;

  -- The board, read as Z: the top three with their shared and skipped
  -- places, and only Z's row marked as the caller's.
  SELECT string_agg(s.username || ':' || s.rank || ':' || s.is_me, ',' ORDER BY s.pos) INTO v_top
    FROM (SELECT row_number() OVER () AS pos, * FROM public.leaderboard_trophies) s WHERE s.pos <= 3;
  IF v_top <> 'RankX:1:false,RankY:1:false,RankZ:3:true' THEN
    RAISE EXCEPTION 'the top of the board read as RankZ is % (expected RankX:1:false,RankY:1:false,RankZ:3:true)', v_top;
  END IF;
  SELECT count(*) INTO v_n FROM public.leaderboard_trophies WHERE is_me;
  IF v_n <> 1 THEN RAISE EXCEPTION 'leaderboard_trophies marks % rows as the caller''s (expected 1)', v_n; END IF;

  -- No players row yet: no rank row, rather than a made-up one.
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_none::text, 'role', 'authenticated')::text, true);
  SELECT count(*) INTO v_n FROM public.get_my_rank();
  IF v_n <> 0 THEN RAISE EXCEPTION 'get_my_rank invented a rank for a player with no players row'; END IF;
  SELECT count(*) INTO v_n FROM public.leaderboard_trophies WHERE is_me;
  IF v_n <> 0 THEN RAISE EXCEPTION 'leaderboard_trophies marks a row as belonging to a player who has none'; END IF;
  RESET ROLE;

  RAISE NOTICE 'trophy and rank behavioural assertions passed';
END $$;
SQL

echo "==> Migrations apply cleanly and the security properties hold"
