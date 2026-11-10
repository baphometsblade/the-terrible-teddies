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
  PERFORM public.sync_player_level(100, 10000);
  SELECT experience INTO v_exp FROM public.players WHERE user_id = uid;
  IF v_exp > 200 THEN
    RAISE EXCEPTION 'sync_player_level did NOT cap the experience increase: got %', v_exp;
  END IF;
  PERFORM public.sync_player_level(100, 10000);
  PERFORM public.sync_player_level(100, 10000);
  PERFORM public.sync_player_level(100, 10000);
  PERFORM public.sync_player_level(100, 10000);
  PERFORM public.sync_player_level(100, 10000); -- 6th call in the window
  SELECT experience INTO v_exp FROM public.players WHERE user_id = uid;
  IF v_exp > 1000 THEN
    RAISE EXCEPTION 'sync_player_level is NOT rate-limited: a rapid loop reached experience %', v_exp;
  END IF;

  -- (2) Rapid battle syncs must be rate-limited: with the server default of
  --     5 per window, the 6th win in one window must not land.
  PERFORM public.sync_battle_result(true, 0, 0, 0);
  PERFORM public.sync_battle_result(true, 0, 0, 0);
  PERFORM public.sync_battle_result(true, 0, 0, 0);
  PERFORM public.sync_battle_result(true, 0, 0, 0);
  PERFORM public.sync_battle_result(true, 0, 0, 0);
  PERFORM public.sync_battle_result(true, 0, 0, 0);
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
  PERFORM upsert_player_profile(repeat('A', 500) || '<script>');
  SELECT username INTO v_name FROM public.players WHERE user_id = v_user;
  IF v_name IS NULL OR char_length(v_name) > 20 OR v_name !~ '^[A-Za-z0-9 _.!?-]+$' THEN
    RAISE EXCEPTION 'upsert_player_profile stored an unvalidated username: %', left(coalesce(v_name,'<null>'), 40);
  END IF;

  -- ...while still keeping a name that WOULD pass set_player_username.
  DELETE FROM public.players WHERE user_id = v_user;
  PERFORM upsert_player_profile('Grizzly Pete');
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
    -- The limiter keys the row on auth.uid(), not an argument.
    PERFORM set_config('request.jwt.claims',
      json_build_object('sub', v_user::text, 'role', 'authenticated')::text, true);
    BEGIN
      PERFORM check_rate_limit('definitely-not-a-real-action');
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
    IF NOT (check_rate_limit('checkout')
        AND check_rate_limit('battle_result')
        AND check_rate_limit('level_sync')) THEN
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

  -- The trophy board is read-only, and anonymous visitors can read it.
  -- It exposes ranking columns only; that is checked behaviourally below.
  IF NOT has_table_privilege('anon', 'public.leaderboard_trophies', 'SELECT') THEN
    bad := bad || '  anon cannot SELECT leaderboard_trophies' || chr(10);
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
  BEGIN PERFORM 1 FROM public.leaderboard_trophies; ok := TRUE; EXCEPTION WHEN insufficient_privilege THEN ok := FALSE; END;
  IF NOT ok THEN RAISE EXCEPTION 'anon cannot read the public leaderboard'; END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'leaderboard_trophies'
      AND column_name IN ('user_id', 'coins', 'xp', 'level')
  ) THEN
    RAISE EXCEPTION 'leaderboard_trophies exposes a private column';
  END IF;
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

# ---------------------------------------------------------------------------
# 20261024000000_board_trophies_index.sql
# ---------------------------------------------------------------------------
echo "==> Asserting the trophy board reads an indexed column that is the formula (same answers, no full scan)"
"${PSQL[@]}" <<'SQL'
DO $$
DECLARE
  v_null UUID := 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1';
  v_neg  UUID := 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee2';
  v_edge UUID := 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee3';
  v_big  UUID := 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee4';
  v_bad INTEGER;
  v_n INTEGER;
  v_rank BIGINT;
  v_plan TEXT;
  v_ok BOOLEAN := FALSE;
  v_def TEXT;
  v_sql TEXT;
  r RECORD;
BEGIN
  -- Rows at the formula's edges, beside every row the earlier blocks made:
  -- nothing recorded, negative experience, a level boundary, a large save.
  INSERT INTO auth.users(id) VALUES (v_null), (v_neg), (v_edge), (v_big) ON CONFLICT DO NOTHING;
  INSERT INTO public.players (user_id, username, wins, experience, best_win_streak) VALUES
    (v_null, 'EdgeNull', NULL, NULL, NULL),
    (v_neg, 'EdgeNeg', 5, -50, 1),
    (v_edge, 'EdgeLevel', 10, 100, 0),
    (v_big, 'EdgeBig', 120, 4321, 9)
  ON CONFLICT (user_id) DO UPDATE SET
    username = EXCLUDED.username, wins = EXCLUDED.wins,
    experience = EXCLUDED.experience, best_win_streak = EXCLUDED.best_win_streak;

  -- The column is the pinned formula on every row, and stays it through a write.
  SELECT count(*) INTO v_bad FROM public.players
   WHERE board_trophies IS DISTINCT FROM public.player_trophies(wins, experience, best_win_streak);
  IF v_bad <> 0 THEN RAISE EXCEPTION 'board_trophies differs from player_trophies() on % row(s)', v_bad; END IF;
  UPDATE public.players SET wins = 11 WHERE user_id = v_edge;
  SELECT count(*) INTO v_bad FROM public.players WHERE user_id = v_edge AND board_trophies <> 108;
  IF v_bad <> 0 THEN RAISE EXCEPTION 'board_trophies did not follow a write to wins'; END IF;

  -- Nothing can write it: Postgres computes it.
  BEGIN
    UPDATE public.players SET board_trophies = 999999 WHERE user_id = v_edge;
  EXCEPTION WHEN generated_always THEN v_ok := TRUE;
  END;
  IF NOT v_ok THEN RAISE EXCEPTION 'board_trophies accepted a direct write'; END IF;

  -- Neither read evaluates the formula per row any more: that is what made
  -- them full scans.
  IF position('player_trophies' IN pg_get_viewdef('public.leaderboard_trophies'::regclass)) > 0 THEN
    RAISE EXCEPTION 'leaderboard_trophies still computes player_trophies() per row';
  END IF;
  IF position('player_trophies' IN pg_get_functiondef('public.get_my_rank()'::regprocedure)) > 0
     OR position('board_trophies' IN pg_get_functiondef('public.get_my_rank()'::regprocedure)) = 0 THEN
    RAISE EXCEPTION 'get_my_rank does not count on board_trophies';
  END IF;

  -- And both use the index. Sequential scans are priced out first, because a
  -- table this small is cheapest read whole: a plan that still cannot use the
  -- index (an expression in place of the column, an index on something else)
  -- falls back to one regardless, and this sees it.
  PERFORM set_config('enable_seqscan', 'off', true);
  -- The view is a security-invoker wrapper over a security-definer function,
  -- which the planner will not inline. Explain the function body itself:
  -- that is the statement that has to use the trophy index.
  v_def := pg_get_functiondef('public.leaderboard_trophies_rows()'::regprocedure);
  v_sql := (regexp_match(
    replace(v_def, chr(10), ' '),
    '[$]function[$](.*)[$]function[$]'
  ))[1];
  EXECUTE 'EXPLAIN (FORMAT JSON) ' || v_sql INTO v_plan;
  IF position('players_board_trophies_idx' IN v_plan) = 0 THEN
    RAISE EXCEPTION 'the board does not read players_board_trophies_idx: %', v_plan;
  END IF;
  -- The top 100 come off the index in order: only the ties are sorted
  -- (Incremental Sort), never every player.
  IF v_plan ~ '"Node Type": "Sort"' THEN
    RAISE EXCEPTION 'the board sorts the whole table: %', v_plan;
  END IF;
  -- get_my_rank's count, as its body runs it.
  EXECUTE 'EXPLAIN (FORMAT JSON) SELECT count(*) FROM public.players o WHERE o.board_trophies > 100' INTO v_plan;
  IF position('players_board_trophies_idx' IN v_plan) = 0 THEN
    RAISE EXCEPTION 'the rank count does not read players_board_trophies_idx: %', v_plan;
  END IF;
  PERFORM set_config('enable_seqscan', 'on', true);

  -- The same answers as the formula, for every player: get_my_rank is 1 +
  -- the players with strictly more player_trophies(), and the board ranks
  -- each row the same way (the trophies block above checks the board too).
  EXECUTE 'SET LOCAL ROLE authenticated';
  FOR r IN SELECT p.user_id,
                  1 + (SELECT count(*) FROM public.players o
                        WHERE public.player_trophies(o.wins, o.experience, o.best_win_streak)
                            > public.player_trophies(p.wins, p.experience, p.best_win_streak)) AS want
             FROM public.players p
  LOOP
    PERFORM set_config('request.jwt.claims', json_build_object('sub', r.user_id::text, 'role', 'authenticated')::text, true);
    SELECT g.rank INTO v_rank FROM public.get_my_rank() g;
    IF v_rank IS DISTINCT FROM r.want THEN
      RAISE EXCEPTION 'get_my_rank for % is %, the formula says %', r.user_id, v_rank, r.want;
    END IF;
  END LOOP;
  RESET ROLE;
  SELECT count(*) INTO v_n FROM public.players;

  RAISE NOTICE 'board_trophies assertions passed (% players ranked identically)', v_n;
END $$;
SQL

# ---------------------------------------------------------------------------
# 20261023000100_one_starter_per_account.sql
# ---------------------------------------------------------------------------
echo "==> Asserting one Starter Gem Pack per account: open checkouts and fulfilment"
"${PSQL[@]}" <<'SQL'
-- A buyer with two starter checkouts open could pay both: the checkout guard
-- only sees fulfilled rows. checkout_holds keeps one open session per account,
-- and fulfill_gem_purchase refuses (PT409) a second starter so the webhook
-- refunds it. These execute every branch the edge functions rely on, as the
-- role that would call it.
DO $$
DECLARE
  v_buyer  UUID := '5ca1ab1e-0000-4000-8000-000000000001';
  v_other  UUID := '5ca1ab1e-0000-4000-8000-000000000002';
  v_out    TEXT;
  v_gems   INTEGER;
  v_rows   INTEGER;
  v_hold   RECORD;
  v_raised BOOLEAN;
  fn       TEXT;
BEGIN
  INSERT INTO auth.users(id) VALUES (v_buyer), (v_other) ON CONFLICT DO NOTHING;

  -- (1) Server-only: no client role may execute the hold or refund functions,
  --     nor touch the table (RLS is on with no policy, and nothing is granted).
  FOR fn IN SELECT unnest(ARRAY['get_checkout_hold','claim_checkout_hold','record_refunded_duplicate','one_per_account_bundle'])
  LOOP
    IF EXISTS (
      SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.proname = fn
        AND (has_function_privilege('anon', p.oid, 'EXECUTE') OR has_function_privilege('authenticated', p.oid, 'EXECUTE'))
    ) THEN RAISE EXCEPTION 'a client role can EXECUTE %', fn; END IF;
  END LOOP;
  IF EXISTS (
    SELECT 1 FROM information_schema.role_table_grants
    WHERE table_name = 'checkout_holds' AND grantee IN ('anon','authenticated')
  ) THEN RAISE EXCEPTION 'anon/authenticated hold a privilege on checkout_holds'; END IF;
  IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.checkout_holds'::regclass) THEN
    RAISE EXCEPTION 'checkout_holds has RLS off';
  END IF;
  -- ...and executing as one is refused, not just absent from the grant table.
  v_raised := FALSE;
  BEGIN
    PERFORM set_config('request.jwt.claims',
      json_build_object('sub', v_buyer::text, 'role', 'authenticated')::text, true);
    EXECUTE 'SET LOCAL ROLE authenticated';
    PERFORM claim_checkout_hold(v_buyer, 'starter_bundle', 'cs_forged', 'https://evil.test', NOW() + interval '1 day');
  EXCEPTION WHEN insufficient_privilege THEN
    v_raised := TRUE;
  END;
  RESET ROLE;
  PERFORM set_config('request.jwt.claims', '', true);
  IF NOT v_raised THEN RAISE EXCEPTION 'an authenticated caller could claim a checkout hold'; END IF;

  -- (2) The first open checkout is the account's; a second is told about it.
  SELECT * INTO v_hold FROM claim_checkout_hold(v_buyer, 'starter_bundle', 'cs_hold_1', 'https://checkout.stripe.com/c/1', NOW() + interval '31 minutes');
  IF NOT v_hold.claimed OR v_hold.stripe_session_id <> 'cs_hold_1' THEN
    RAISE EXCEPTION 'the first starter checkout was not recorded (%)', row_to_json(v_hold);
  END IF;
  SELECT * INTO v_hold FROM claim_checkout_hold(v_buyer, 'starter_bundle', 'cs_hold_2', 'https://checkout.stripe.com/c/2', NOW() + interval '31 minutes');
  IF v_hold.claimed OR v_hold.stripe_session_id <> 'cs_hold_1' OR v_hold.checkout_url <> 'https://checkout.stripe.com/c/1' THEN
    RAISE EXCEPTION 'a second open starter checkout replaced the first (%)', row_to_json(v_hold);
  END IF;
  SELECT * INTO v_hold FROM get_checkout_hold(v_buyer, 'starter_bundle');
  IF v_hold.stripe_session_id IS DISTINCT FROM 'cs_hold_1' THEN
    RAISE EXCEPTION 'get_checkout_hold did not return the open checkout (%)', row_to_json(v_hold);
  END IF;
  -- Another account's checkout is its own.
  SELECT * INTO v_hold FROM claim_checkout_hold(v_other, 'starter_bundle', 'cs_hold_other', 'https://checkout.stripe.com/c/o', NOW() + interval '31 minutes');
  IF NOT v_hold.claimed THEN RAISE EXCEPTION 'one account''s hold blocked another account'; END IF;

  -- (3) It gives way only to the session the caller confirmed finished, or
  --     once it has expired.
  SELECT * INTO v_hold FROM claim_checkout_hold(v_buyer, 'starter_bundle', 'cs_hold_3', 'https://checkout.stripe.com/c/3', NOW() + interval '31 minutes', 'cs_not_the_hold');
  IF v_hold.claimed THEN RAISE EXCEPTION 'p_replaces naming another session displaced the hold'; END IF;
  SELECT * INTO v_hold FROM claim_checkout_hold(v_buyer, 'starter_bundle', 'cs_hold_3', 'https://checkout.stripe.com/c/3', NOW() + interval '31 minutes', 'cs_hold_1');
  IF NOT v_hold.claimed OR v_hold.stripe_session_id <> 'cs_hold_3' THEN
    RAISE EXCEPTION 'a finished session could not be replaced (%)', row_to_json(v_hold);
  END IF;
  UPDATE checkout_holds SET expires_at = NOW() - interval '1 minute' WHERE user_id = v_buyer;
  SELECT count(*) INTO v_rows FROM get_checkout_hold(v_buyer, 'starter_bundle');
  IF v_rows <> 0 THEN RAISE EXCEPTION 'get_checkout_hold returned an expired checkout'; END IF;
  SELECT * INTO v_hold FROM claim_checkout_hold(v_buyer, 'starter_bundle', 'cs_hold_4', 'https://checkout.stripe.com/c/4', NOW() + interval '31 minutes');
  IF NOT v_hold.claimed THEN RAISE EXCEPTION 'an expired hold was not replaced'; END IF;
  -- Holds are only for one-per-account bundles.
  v_raised := FALSE;
  BEGIN
    PERFORM claim_checkout_hold(v_buyer, 'gems_small', 'cs_hold_small', 'https://checkout.stripe.com/c/s', NOW() + interval '1 hour');
  EXCEPTION WHEN OTHERS THEN v_raised := TRUE;
  END;
  IF NOT v_raised THEN RAISE EXCEPTION 'claim_checkout_hold accepted an ordinary bundle'; END IF;

  -- (4) Fulfilment: the first starter credits, a second paid one is refused
  --     with PT409 and credits nothing, and a replay of the first is harmless.
  SELECT fulfill_gem_purchase(v_buyer, 'starter_bundle', 300, 'cs_dup_first', 499, 'pi_dup_first') INTO v_out;
  IF v_out <> 'credited' THEN RAISE EXCEPTION 'the first starter was not credited (%)', v_out; END IF;
  v_raised := FALSE;
  BEGIN
    PERFORM fulfill_gem_purchase(v_buyer, 'starter_bundle', 300, 'cs_dup_second', 499, 'pi_dup_second');
  EXCEPTION WHEN SQLSTATE 'PT409' THEN
    v_raised := TRUE;
  END;
  SELECT gems INTO v_gems FROM user_gems WHERE user_id = v_buyer;
  IF NOT v_raised THEN RAISE EXCEPTION 'a second paid starter was not refused with PT409'; END IF;
  IF v_gems <> 300 THEN RAISE EXCEPTION 'a second starter changed the balance (gems=%)', v_gems; END IF;
  IF EXISTS (SELECT 1 FROM purchases WHERE stripe_session_id = 'cs_dup_second') THEN
    RAISE EXCEPTION 'the refused starter left a purchases row behind';
  END IF;
  SELECT fulfill_gem_purchase(v_buyer, 'starter_bundle', 300, 'cs_dup_first', 499, 'pi_dup_first') INTO v_out;
  IF v_out <> 'duplicate' THEN RAISE EXCEPTION 'a replay of the credited starter was not a duplicate (%)', v_out; END IF;

  -- (5) The refund is recorded once, credits nothing, and leaves the rest of
  --     the money path alone: replays say duplicate, Stripe's charge.refunded
  --     for it finds nothing to reverse, and it can never be restored.
  SELECT record_refunded_duplicate(v_buyer, 'starter_bundle', 300, 'cs_dup_second', 499, 'pi_dup_second') INTO v_out;
  IF v_out <> 'recorded' THEN RAISE EXCEPTION 'the refunded duplicate was not recorded (%)', v_out; END IF;
  SELECT record_refunded_duplicate(v_buyer, 'starter_bundle', 300, 'cs_dup_second', 499, 'pi_dup_second') INTO v_out;
  IF v_out <> 'duplicate' THEN RAISE EXCEPTION 'recording the refund twice wrote twice (%)', v_out; END IF;
  SELECT fulfill_gem_purchase(v_buyer, 'starter_bundle', 300, 'cs_dup_second', 499, 'pi_dup_second') INTO v_out;
  IF v_out <> 'duplicate' THEN RAISE EXCEPTION 'a replay of the refunded starter was not a duplicate (%)', v_out; END IF;
  SELECT reverse_gem_purchase('pi_dup_second', 'refunded') INTO v_out;
  IF v_out <> 'already_reversed' THEN RAISE EXCEPTION 'the duplicate''s own refund event reversed something (%)', v_out; END IF;
  SELECT restore_gem_purchase('pi_dup_second') INTO v_out;
  IF v_out <> 'not_reversed' THEN RAISE EXCEPTION 'a refunded duplicate was restorable (%)', v_out; END IF;
  SELECT gems INTO v_gems FROM user_gems WHERE user_id = v_buyer;
  IF v_gems <> 300 THEN RAISE EXCEPTION 'recording the duplicate moved gems (gems=%)', v_gems; END IF;
  -- The buyer can read that row (the purchase screen explains the refund).
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', v_buyer::text, 'role', 'authenticated')::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  SELECT count(*) INTO v_rows FROM public.purchases WHERE stripe_session_id = 'cs_dup_second' AND status = 'refunded_duplicate';
  RESET ROLE;
  PERFORM set_config('request.jwt.claims', '', true);
  IF v_rows <> 1 THEN RAISE EXCEPTION 'the buyer cannot read their refunded duplicate (saw %)', v_rows; END IF;

  -- (6) What holds the one, as checkoutGuards.js counts it: a disputed
  --     starter still does (a won dispute restores it), a refunded one frees it.
  UPDATE purchases SET status = 'disputed' WHERE stripe_session_id = 'cs_dup_first';
  v_raised := FALSE;
  BEGIN
    PERFORM fulfill_gem_purchase(v_buyer, 'starter_bundle', 300, 'cs_dup_third', 499, 'pi_dup_third');
  EXCEPTION WHEN SQLSTATE 'PT409' THEN v_raised := TRUE;
  END;
  IF NOT v_raised THEN RAISE EXCEPTION 'a starter bought during a dispute was credited'; END IF;
  UPDATE purchases SET status = 'refunded' WHERE stripe_session_id = 'cs_dup_first';
  SELECT fulfill_gem_purchase(v_buyer, 'starter_bundle', 300, 'cs_dup_fourth', 499, 'pi_dup_fourth') INTO v_out;
  IF v_out <> 'credited' THEN RAISE EXCEPTION 'a starter after a refunded one was refused (%)', v_out; END IF;

  -- (7) Ordinary bundles are never limited.
  SELECT fulfill_gem_purchase(v_other, 'gems_small', 50, 'cs_small_1', 99, 'pi_small_1') INTO v_out;
  IF v_out <> 'credited' THEN RAISE EXCEPTION 'an ordinary bundle was refused (%)', v_out; END IF;
  SELECT fulfill_gem_purchase(v_other, 'gems_small', 50, 'cs_small_2', 99, 'pi_small_2') INTO v_out;
  IF v_out <> 'credited' THEN RAISE EXCEPTION 'a second ordinary bundle was refused (%)', v_out; END IF;

  RAISE NOTICE 'one-starter-per-account assertions passed';
END $$;
SQL

echo "==> Asserting two overlapping starter fulfilments cannot both credit"
# The case the advisory lock exists for, run as it happens: two webhook
# deliveries for two paid starter sessions of one account, in flight at once.
# A credits and holds its transaction open; B starts meanwhile. Without the
# lock B cannot see A's uncommitted row and credits a second starter (verified:
# 600 gems, two 'completed' rows); with it B waits for A and is refused.
CONC_USER='c0ffee00-0000-4000-8000-000000000001'
"${PSQL[@]}" -c "INSERT INTO auth.users(id) VALUES ('$CONC_USER') ON CONFLICT DO NOTHING;"
"${PSQL[@]}" -c "BEGIN; SELECT fulfill_gem_purchase('$CONC_USER', 'starter_bundle', 300, 'cs_conc_a', 499, 'pi_conc_a'); SELECT pg_sleep(3); COMMIT;" >/dev/null &
CONC_A=$!
sleep 1
CONC_B_OUT=$(psql "$DB" -q -t -A -c "SELECT fulfill_gem_purchase('$CONC_USER', 'starter_bundle', 300, 'cs_conc_b', 499, 'pi_conc_b');" 2>&1 || true)
wait "$CONC_A"
CONC_GEMS=$(psql "$DB" -q -t -A -c "SELECT gems FROM user_gems WHERE user_id = '$CONC_USER';")
if [ "$CONC_GEMS" != "300" ] || ! grep -q one_per_account_already_held <<<"$CONC_B_OUT"; then
  echo "    FAIL overlapping starter fulfilments: gems=$CONC_GEMS, second said: $CONC_B_OUT"
  exit 1
fi
echo "    ok   the second waited for the first and was refused"

echo "==> Asserting house titles: own row, allowlist, rate limit, no anon, no direct write"
"${PSQL[@]}" <<'SQL'
DO $$
DECLARE
  v_a     UUID := 'a11a11a1-1111-4111-8111-111111111111';
  v_b     UUID := 'b22b22b2-2222-4222-8222-222222222222';
  v_title TEXT;
  v_other TEXT;
  i       INTEGER;
BEGIN
  INSERT INTO auth.users (id) VALUES (v_a), (v_b) ON CONFLICT DO NOTHING;
  INSERT INTO public.players (user_id, username) VALUES
    (v_a, 'TitleBear'), (v_b, 'OtherBear')
  ON CONFLICT DO NOTHING;

  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'set_house_title' AND p.prosecdef
      AND EXISTS (SELECT 1 FROM unnest(p.proconfig) c WHERE c LIKE 'search_path=%')
  ) THEN
    RAISE EXCEPTION 'set_house_title is not SECURITY DEFINER with a pinned search_path';
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'set_house_title'
      AND has_function_privilege('anon', p.oid, 'EXECUTE')
  ) THEN
    RAISE EXCEPTION 'anon can EXECUTE set_house_title';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'set_house_title'
      AND has_function_privilege('authenticated', p.oid, 'EXECUTE')
  ) THEN
    RAISE EXCEPTION 'authenticated cannot EXECUTE set_house_title';
  END IF;

  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', v_a::text, 'role', 'authenticated')::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';

  BEGIN
    UPDATE public.players SET house_title = 'lucky' WHERE user_id = v_a;
    RAISE EXCEPTION 'authenticated updated house_title directly';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;

  SELECT set_house_title('lucky') INTO v_title;
  IF v_title <> 'lucky' THEN RAISE EXCEPTION 'a known title was not stored (%)', v_title; END IF;

  BEGIN
    PERFORM set_house_title('not-a-title');
    RAISE EXCEPTION 'an unknown title was accepted';
  EXCEPTION WHEN invalid_parameter_value THEN NULL;
  END;
  SELECT house_title INTO v_title FROM public.players WHERE user_id = v_a;
  IF v_title <> 'lucky' THEN RAISE EXCEPTION 'a refused title changed the row to %', v_title; END IF;

  SELECT set_house_title('') INTO v_title;
  IF v_title IS NOT NULL THEN RAISE EXCEPTION 'clearing the title returned %', v_title; END IF;
  SELECT house_title INTO v_title FROM public.players WHERE user_id = v_a;
  IF v_title IS NOT NULL THEN RAISE EXCEPTION 'the title was not cleared (%)', v_title; END IF;

  -- Two calls so far (set, clear). Eight more fill the window of ten.
  FOR i IN 1..8 LOOP
    PERFORM set_house_title('counsel');
  END LOOP;
  BEGIN
    PERFORM set_house_title('closing');
    RAISE EXCEPTION 'the 11th wear in a minute was allowed';
  EXCEPTION WHEN SQLSTATE 'PT429' THEN NULL;
  END;
  SELECT house_title INTO v_title FROM public.players WHERE user_id = v_a;
  IF v_title <> 'counsel' THEN RAISE EXCEPTION 'a limited wear changed the title to %', v_title; END IF;

  SELECT house_title INTO v_other FROM public.players WHERE user_id = v_b;
  IF v_other IS NOT NULL THEN RAISE EXCEPTION 'another account''s title was written (%)', v_other; END IF;

  RESET ROLE;
  RAISE NOTICE 'house title assertions passed';
END $$;
SQL

echo "==> Asserting platform flags, the staff desk, and account export/deletion"
"${PSQL[@]}" <<'SQL'
DO $$
DECLARE
  v_staff  UUID := 'd1d1d1d1-d1d1-41d1-81d1-d1d1d1d1d1d1';
  v_guest  UUID := 'e2e2e2e2-e2e2-42e2-82e2-e2e2e2e2e2e2';
  v_leaver UUID := 'f3f3f3f3-f3f3-43f3-83f3-f3f3f3f3f3f3';
  v_rows   INTEGER;
  v_raised BOOLEAN;
  v_json   JSONB;
  v_uid    UUID;
  v_on     BOOLEAN;
BEGIN
  INSERT INTO auth.users (id, email) VALUES
    (v_staff, 'staff@example.com'),
    (v_guest, 'guest@example.com'),
    (v_leaver, 'leaver@example.com')
  ON CONFLICT DO NOTHING;
  INSERT INTO public.players (user_id, username) VALUES
    (v_leaver, 'Leaver')
  ON CONFLICT DO NOTHING;
  INSERT INTO public.admins (user_id) VALUES (v_staff) ON CONFLICT DO NOTHING;
  INSERT INTO public.purchases (user_id, bundle_id, gems_granted, stripe_session_id, amount_paid, status) VALUES
    (v_leaver, 'gems_small', 50, 'cs_platform_leaver', 99, 'completed'),
    (v_staff, 'gems_mega', 3000, 'cs_platform_staff', 4999, 'completed');

  -- Flags: anon may read the seeded rows, and may not write one.
  EXECUTE 'SET LOCAL ROLE anon';
  SELECT count(*) INTO v_rows FROM public.feature_flags;
  RESET ROLE;
  IF v_rows < 3 THEN
    RAISE EXCEPTION 'anon could not read feature flags (saw %)', v_rows;
  END IF;
  SELECT enabled INTO v_on FROM public.feature_flags WHERE key = 'public_landing';
  IF v_on IS NOT TRUE THEN RAISE EXCEPTION 'public_landing was not seeded on'; END IF;

  v_raised := FALSE;
  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    INSERT INTO public.feature_flags (key, enabled) VALUES ('forged_flag', true);
  EXCEPTION WHEN OTHERS THEN
    v_raised := TRUE;
  END;
  RESET ROLE;
  IF NOT v_raised THEN RAISE EXCEPTION 'a signed-in player could write a feature flag'; END IF;

  v_raised := FALSE;
  BEGIN
    INSERT INTO public.feature_flags (key, enabled) VALUES ('Bad Key', true);
  EXCEPTION WHEN check_violation THEN
    v_raised := TRUE;
  END;
  IF NOT v_raised THEN RAISE EXCEPTION 'a flag key with a space was accepted'; END IF;

  -- Staff rows are visible only to the person they name.
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', v_guest::text, 'role', 'authenticated')::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  SELECT count(*) INTO v_rows FROM public.admins;
  RESET ROLE;
  IF v_rows <> 0 THEN RAISE EXCEPTION 'a non-admin could see staff rows (%)', v_rows; END IF;

  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', v_staff::text, 'role', 'authenticated')::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  SELECT count(*) INTO v_rows FROM public.admins;
  RESET ROLE;
  IF v_rows <> 1 THEN RAISE EXCEPTION 'staff could not see their own row (%)', v_rows; END IF;

  -- Anon cannot execute the staff or account functions.
  v_raised := FALSE;
  BEGIN
    EXECUTE 'SET LOCAL ROLE anon';
    PERFORM public.admin_growth_stats();
  EXCEPTION WHEN insufficient_privilege THEN
    v_raised := TRUE;
  END;
  RESET ROLE;
  IF NOT v_raised THEN RAISE EXCEPTION 'anon could call admin_growth_stats'; END IF;

  v_raised := FALSE;
  BEGIN
    EXECUTE 'SET LOCAL ROLE anon';
    PERFORM public.delete_my_account();
  EXCEPTION WHEN insufficient_privilege THEN
    v_raised := TRUE;
  END;
  RESET ROLE;
  IF NOT v_raised THEN RAISE EXCEPTION 'anon could call delete_my_account'; END IF;

  -- A signed-in non-admin is refused. A match they play still counts.
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', v_guest::text, 'role', 'authenticated')::text, true);
  v_raised := FALSE;
  BEGIN
    PERFORM public.admin_growth_stats();
  EXCEPTION WHEN SQLSTATE 'PT403' THEN
    v_raised := TRUE;
  END;
  IF NOT v_raised THEN RAISE EXCEPTION 'a non-admin read the staff counts'; END IF;
  PERFORM public.log_played_match(true);
  PERFORM public.log_played_match(false);
  PERFORM public.touch_player_activity();

  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', v_staff::text, 'role', 'authenticated')::text, true);
  SELECT public.admin_growth_stats() INTO v_json;
  IF (v_json->>'signups')::int < 3 THEN
    RAISE EXCEPTION 'signups were not counted (%)', v_json;
  END IF;
  IF (v_json->>'dau')::int < 1 OR (v_json->>'matches')::int < 2 OR (v_json->>'matches_today')::int < 2 THEN
    RAISE EXCEPTION 'activity was not counted (%)', v_json;
  END IF;
  IF v_json::text LIKE '%guest@example.com%' OR v_json::text LIKE '%' || v_guest::text || '%' THEN
    RAISE EXCEPTION 'the staff counts named a player (%)', v_json;
  END IF;

  -- Export is the caller's own rows, without the processor reference.
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', v_leaver::text, 'role', 'authenticated')::text, true);
  SELECT public.export_my_data() INTO v_json;
  IF v_json->>'email' IS DISTINCT FROM 'leaver@example.com' THEN
    RAISE EXCEPTION 'export email was %', v_json->>'email';
  END IF;
  IF v_json->'player'->>'username' IS DISTINCT FROM 'Leaver' THEN
    RAISE EXCEPTION 'export missed the profile (%)', v_json->'player';
  END IF;
  IF jsonb_array_length(v_json->'purchases') <> 1
     OR v_json->'purchases'->0->>'bundle_id' <> 'gems_small' THEN
    RAISE EXCEPTION 'export did not keep to the caller''s purchases (%)', v_json->'purchases';
  END IF;
  IF v_json::text LIKE '%cs_platform%' OR v_json::text LIKE '%gems_mega%' THEN
    RAISE EXCEPTION 'export leaked a processor id or someone else''s bundle (%)', v_json;
  END IF;

  PERFORM public.delete_my_account();
  IF EXISTS (SELECT 1 FROM auth.users WHERE id = v_leaver) THEN
    RAISE EXCEPTION 'the account was not deleted';
  END IF;
  IF EXISTS (SELECT 1 FROM public.players WHERE user_id = v_leaver) THEN
    RAISE EXCEPTION 'the profile survived the account';
  END IF;
  SELECT user_id INTO v_uid FROM public.purchases WHERE stripe_session_id = 'cs_platform_leaver';
  IF v_uid IS NOT NULL THEN RAISE EXCEPTION 'the purchase kept the deleted account'; END IF;
  SELECT user_id INTO v_uid FROM public.purchases WHERE stripe_session_id = 'cs_platform_staff';
  IF v_uid IS DISTINCT FROM v_staff THEN RAISE EXCEPTION 'someone else''s purchase was touched'; END IF;
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = v_staff) THEN
    RAISE EXCEPTION 'delete removed a different account';
  END IF;

  RAISE NOTICE 'platform assertions passed';
END $$;
SQL

echo "==> Asserting the social ladder (rating is server-side, clients cannot write it)"
"${PSQL[@]}" <<'SQL'
DO $$
DECLARE
  v_a UUID := 'a11ce000-0000-4000-8000-00000000000a';
  v_b UUID := 'b0b00000-0000-4000-8000-00000000000b';
  v_json JSONB;
  v_code TEXT;
  v_match UUID;
  v_rating INTEGER;
  v_wins INTEGER;
  v_losses INTEGER;
  v_delta INTEGER;
  v_b_rating INTEGER;
  v_denied BOOLEAN;
  i INTEGER;
BEGIN
  IF public.ladder_season_id('2026-11-07 12:00:00+00') <> '2026-W45' THEN
    RAISE EXCEPTION 'ladder_season_id drifted from ISO week: %', public.ladder_season_id('2026-11-07 12:00:00+00');
  END IF;
  IF public.ladder_season_id('2026-01-01 00:00:00+00') <> '2026-W01' THEN
    RAISE EXCEPTION '2026-01-01 is not 2026-W01';
  END IF;
  IF public.ladder_season_id('2021-01-01 00:00:00+00') <> '2020-W53' THEN
    RAISE EXCEPTION '2021-01-01 is not 2020-W53';
  END IF;
  IF public.ladder_tier(1049) <> 'Warming Up' OR public.ladder_tier(1050) <> 'Getting Handsy'
     OR public.ladder_tier(1999) <> 'Last Call' OR public.ladder_tier(2000) <> 'All Night' THEN
    RAISE EXCEPTION 'ladder tiers drifted';
  END IF;
  IF public.ladder_soft(1400) <> 1200 OR public.ladder_soft(900) <> 950 THEN
    RAISE EXCEPTION 'soft reset drifted: 1400->%, 900->%', public.ladder_soft(1400), public.ladder_soft(900);
  END IF;
  IF public.ladder_delta(1000, 1000, true) <> 12
     OR public.ladder_delta(1000, 1000, false) <> -12
     OR public.ladder_delta(1000, 1400, true) <> 22
     OR public.ladder_delta(1400, 1000, true) <> 2 THEN
    RAISE EXCEPTION 'elo drifted: % % % %',
      public.ladder_delta(1000, 1000, true), public.ladder_delta(1000, 1000, false),
      public.ladder_delta(1000, 1400, true), public.ladder_delta(1400, 1000, true);
  END IF;

  INSERT INTO auth.users (id) VALUES (v_a), (v_b) ON CONFLICT DO NOTHING;
  INSERT INTO public.players (user_id, username) VALUES (v_a, 'Ada'), (v_b, 'DreadBear')
  ON CONFLICT (user_id) DO UPDATE SET username = EXCLUDED.username;

  -- Clients cannot write the ladder tables, the way they cannot write players.
  v_denied := FALSE;
  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    UPDATE public.ladder_players SET rating = 2400 WHERE user_id = v_a;
  EXCEPTION WHEN insufficient_privilege THEN
    v_denied := TRUE;
  END;
  EXECUTE 'RESET ROLE';
  IF NOT v_denied THEN
    RAISE EXCEPTION 'authenticated could UPDATE ladder_players';
  END IF;

  v_denied := FALSE;
  BEGIN
    EXECUTE 'SET LOCAL ROLE anon';
    PERFORM public.report_ladder_result('00000000-0000-4000-8000-000000000000', true, false);
  EXCEPTION WHEN insufficient_privilege THEN
    v_denied := TRUE;
  END;
  EXECUTE 'RESET ROLE';
  IF NOT v_denied THEN
    RAISE EXCEPTION 'anon could call report_ladder_result';
  END IF;

  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_a::text, 'role', 'authenticated')::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  PERFORM public.my_social();
  EXECUTE 'RESET ROLE';
  UPDATE public.ladder_players SET rating = 1400, season_id = '1999-W01' WHERE user_id = v_a;
  EXECUTE 'SET LOCAL ROLE authenticated';
  v_json := public.my_social();
  EXECUTE 'RESET ROLE';
  IF (v_json->>'rating')::int <> 1200 OR (v_json->>'week_wins')::int <> 0 THEN
    RAISE EXCEPTION 'season reset did not halve toward 1000: %', v_json;
  END IF;
  IF v_json->>'tier' <> 'Regular' THEN
    RAISE EXCEPTION 'tier after reset was %', v_json->>'tier';
  END IF;

  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_b::text, 'role', 'authenticated')::text, true);
  v_json := public.publish_ghost(ARRAY[1,2,3,4,5,6,7,8,9,10]::integer[], 'Saved deck');
  IF v_json->>'ok' <> 'true' THEN RAISE EXCEPTION 'publish failed: %', v_json; END IF;
  v_code := v_json->>'code';
  IF v_code !~ '^[0-9a-f]{10}$' THEN RAISE EXCEPTION 'bad challenge code %', v_code; END IF;

  -- The public preview is a name, a tier and a rating. No deck, no user id.
  IF EXISTS (
    SELECT 1 FROM public.challenge_preview(v_code) p
    WHERE p.username <> 'DreadBear'
  ) THEN
    RAISE EXCEPTION 'preview did not show the saved name';
  END IF;
  IF to_jsonb((SELECT p FROM public.challenge_preview(v_code) p))::text LIKE '%user_id%'
     OR to_jsonb((SELECT p FROM public.challenge_preview(v_code) p))::text LIKE '%deck%' THEN
    RAISE EXCEPTION 'preview leaked a private column';
  END IF;

  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_b::text, 'role', 'authenticated')::text, true);
  v_json := public.open_challenge(v_code);
  IF v_json->>'reason' <> 'self' THEN RAISE EXCEPTION 'self challenge was not refused: %', v_json; END IF;

  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_a::text, 'role', 'authenticated')::text, true);
  -- Even ratings, so the attested win is the +12 the formula gives equals.
  UPDATE public.ladder_players SET rating = 1000 WHERE user_id IN (v_a, v_b);
  v_json := public.open_challenge(v_code);
  v_match := (v_json->>'match_id')::uuid;
  IF v_match IS NULL OR jsonb_typeof(v_json->'deck') <> 'array' THEN
    RAISE EXCEPTION 'challenge did not issue a ticket: %', v_json;
  END IF;
  v_json := public.report_ladder_result(v_match, true, false);
  IF v_json->>'reason' <> 'early' THEN RAISE EXCEPTION 'instant win was accepted: %', v_json; END IF;
  SELECT rating INTO v_rating FROM public.ladder_players WHERE user_id = v_a;
  IF v_rating <> 1000 THEN RAISE EXCEPTION 'early report moved the rating to %', v_rating; END IF;

  UPDATE public.ladder_matches SET created_at = pg_catalog.now() - INTERVAL '1 minute' WHERE id = v_match;
  v_json := public.report_ladder_result(v_match, true, false);
  IF v_json->>'ok' <> 'true' OR (v_json->>'delta')::int <> 12 OR (v_json->>'won')::boolean IS NOT TRUE THEN
    RAISE EXCEPTION 'equal-rating win was not +12: %', v_json;
  END IF;
  SELECT rating, wins INTO v_rating, v_wins FROM public.ladder_players WHERE user_id = v_a;
  SELECT rating INTO v_b_rating FROM public.ladder_players WHERE user_id = v_b;
  IF v_rating <> 1012 OR v_wins <> 1 OR v_b_rating <> 988 THEN
    RAISE EXCEPTION 'ratings after the win: A % (% wins), B %', v_rating, v_wins, v_b_rating;
  END IF;
  v_json := public.report_ladder_result(v_match, true, false);
  SELECT wins INTO v_wins FROM public.ladder_players WHERE user_id = v_a;
  IF v_wins <> 1 OR (v_json->>'delta')::int <> 12 THEN
    RAISE EXCEPTION 'a second report was applied again: wins %, body %', v_wins, v_json;
  END IF;

  -- p_forfeit cannot be combined with a win to skip the floor.
  v_json := public.open_challenge(v_code);
  v_match := (v_json->>'match_id')::uuid;
  v_json := public.report_ladder_result(v_match, true, true);
  SELECT wins, losses, rating INTO v_wins, v_losses, v_rating FROM public.ladder_players WHERE user_id = v_a;
  IF (v_json->>'won')::boolean IS TRUE OR v_wins <> 1 OR v_losses <> 1 THEN
    RAISE EXCEPTION 'forfeit-as-win landed: % wins % losses %', v_json, v_wins, v_losses;
  END IF;

  -- Someone else's ticket is invisible.
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_b::text, 'role', 'authenticated')::text, true);
  v_json := public.report_ladder_result(v_match, true, false);
  IF v_json->>'reason' <> 'missing' THEN
    RAISE EXCEPTION 'B could report A''s ticket: %', v_json;
  END IF;

  -- A short deck is refused, and three copies are refused.
  BEGIN
    PERFORM public.publish_ghost(ARRAY[1,2,3,4,5,6,7,8,9]::integer[], 'Nope');
    RAISE EXCEPTION 'a 9-card deck was accepted';
  EXCEPTION WHEN SQLSTATE '22023' THEN NULL;
  END;
  BEGIN
    PERFORM public.publish_ghost(ARRAY[1,1,1,2,3,4,5,6,7,8]::integer[], 'Nope');
    RAISE EXCEPTION 'three copies were accepted';
  EXCEPTION WHEN SQLSTATE '22023' THEN NULL;
  END;

  -- Queue fights against the same ghost stop at 3 in a season. The two
  -- challenges above do not count toward that.
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_a::text, 'role', 'authenticated')::text, true);
  FOR i IN 1..3 LOOP
    v_json := public.draw_ghost();
    v_match := (v_json->>'match_id')::uuid;
    IF v_match IS NULL THEN RAISE EXCEPTION 'draw % failed: %', i, v_json; END IF;
    UPDATE public.ladder_matches SET created_at = pg_catalog.now() - INTERVAL '1 minute' WHERE id = v_match;
    PERFORM public.report_ladder_result(v_match, false, false);
  END LOOP;
  v_json := public.draw_ghost();
  IF v_json->>'reason' <> 'empty' THEN
    RAISE EXCEPTION 'a fourth queue fight was still offered: %', v_json;
  END IF;

  -- Daily gain cap, then the challenge-link cap (8 a day against one deck).
  -- Earlier tickets would trip the link cap and the rate limit before the
  -- gain cap has anything to refuse, so they are cleared here.
  DELETE FROM public.ladder_matches WHERE challenger_id = v_a OR ghost_id = v_a;
  DELETE FROM public.rate_limits WHERE user_id = v_a;
  UPDATE public.ladder_players SET day_gain = 0, day_loss = 0, rating = 1000 WHERE user_id = v_a;
  UPDATE public.ladder_players SET rating = 1000, day_gain = 0, day_loss = 0 WHERE user_id = v_b;
  v_delta := 0;
  FOR i IN 1..8 LOOP
    v_json := public.open_challenge(v_code);
    IF v_json->>'match_id' IS NULL THEN RAISE EXCEPTION 'cap setup fight % failed: %', i, v_json; END IF;
    v_match := (v_json->>'match_id')::uuid;
    UPDATE public.ladder_matches SET created_at = pg_catalog.now() - INTERVAL '1 minute',
      challenger_rating = 1000, ghost_rating = 1000
    WHERE id = v_match;
    -- The snapshot ratings are what the delta uses. Keep them even.
    v_json := public.report_ladder_result(v_match, true, false);
    v_delta := (v_json->>'delta')::int;
  END LOOP;
  IF v_delta <> 0 THEN
    RAISE EXCEPTION 'the 8th even win still paid rating: %', v_delta;
  END IF;
  SELECT day_gain INTO v_rating FROM public.ladder_players WHERE user_id = v_a;
  IF v_rating <> 80 THEN
    RAISE EXCEPTION 'day gain did not stop at 80 (got %)', v_rating;
  END IF;
  v_json := public.open_challenge(v_code);
  IF v_json->>'reason' <> 'capped' THEN
    RAISE EXCEPTION 'a ninth challenge link in a day was allowed: %', v_json;
  END IF;

  RAISE NOTICE 'social ladder assertions passed';
END $$;
SQL

echo "==> Asserting the back room (follows, gangs, cup, ribbon, referral, slip)"
"${PSQL[@]}" <<'SQL'
DO $$
DECLARE
  v_a UUID := 'c0ffee00-0000-4000-8000-0000000000a1';
  v_b UUID := 'c0ffee00-0000-4000-8000-0000000000b2';
  v_json JSONB;
  v_code TEXT;
  v_ref TEXT;
  v_ribbon TEXT;
  v_denied BOOLEAN;
  v_id UUID;
BEGIN
  INSERT INTO auth.users (id) VALUES (v_a), (v_b) ON CONFLICT DO NOTHING;
  INSERT INTO public.players (user_id, username) VALUES (v_a, 'Ada'), (v_b, 'Bea')
  ON CONFLICT (user_id) DO UPDATE SET username = EXCLUDED.username;

  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_b::text, 'role', 'authenticated')::text, true);
  v_json := public.publish_ghost(ARRAY[1,2,3,4,5,6,7,8,9,10]::integer[], 'Saved deck');
  v_code := v_json->>'code';
  v_json := public.my_room();
  v_ref := v_json->>'referral_code';
  IF v_ref !~ '^[0-9a-f]{10}$' THEN RAISE EXCEPTION 'no referral code: %', v_json; END IF;

  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_a::text, 'role', 'authenticated')::text, true);
  v_json := public.follow_player(v_code);
  IF v_json->>'ok' <> 'true' THEN RAISE EXCEPTION 'follow failed: %', v_json; END IF;
  v_json := public.follow_player(v_code);
  IF v_json->>'ok' <> 'true' THEN RAISE EXCEPTION 'second follow failed: %', v_json; END IF;
  IF (SELECT count(*) FROM public.follows WHERE follower = v_a) <> 1 THEN
    RAISE EXCEPTION 'follow was not idempotent';
  END IF;
  -- Publish A so self-follow can be attempted with A's own code.
  PERFORM public.publish_ghost(ARRAY[1,1,2,3,4,5,6,7,8,9]::integer[], 'Saved deck');
  v_json := public.follow_player((SELECT code FROM public.ghost_decks WHERE user_id = v_a));
  IF v_json->>'reason' <> 'self' THEN RAISE EXCEPTION 'self follow was allowed: %', v_json; END IF;

  v_json := public.set_rival(v_code);
  IF v_json->>'ok' <> 'true' THEN RAISE EXCEPTION 'rival failed: %', v_json; END IF;
  v_json := public.my_room();
  IF v_json->'rival'->>'username' <> 'Bea' THEN RAISE EXCEPTION 'rival name drifted: %', v_json; END IF;

  v_json := public.create_gang('Night Shift', 'hot');
  IF v_json->>'tag' <> 'HOT' THEN RAISE EXCEPTION 'gang tag was not uppercased: %', v_json; END IF;
  v_json := public.create_gang('Other', 'HOT');
  IF v_json->>'reason' <> 'in' THEN RAISE EXCEPTION 'second gang was allowed: %', v_json; END IF;

  -- Ribbon: a played week, then the season rolls.
  UPDATE public.ladder_players
  SET week_wins = 3, week_losses = 1, week_delta = 20, season_id = '1999-W01'
  WHERE user_id = v_a;
  PERFORM public.my_social();
  SELECT ribbon INTO v_ribbon FROM public.ladder_players WHERE user_id = v_a;
  IF v_ribbon <> 'Top stool' THEN RAISE EXCEPTION 'ribbon was %', v_ribbon; END IF;

  -- Taunt allowlist.
  v_json := public.set_greeting(9);
  IF v_json->>'reason' <> 'missing' THEN RAISE EXCEPTION 'bad taunt accepted: %', v_json; END IF;
  v_json := public.set_greeting(3);
  IF v_json->>'ok' <> 'true' THEN RAISE EXCEPTION 'greeting failed: %', v_json; END IF;

  -- Referral: A has reported matches? The follow path did not fight. Publish and a real result.
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_a::text, 'role', 'authenticated')::text, true);
  v_json := public.redeem_referral(v_ref);
  IF v_json->>'reason' <> 'play' THEN RAISE EXCEPTION 'referral paid before a fight: %', v_json; END IF;

  -- One reported loss so the "played" gate opens, then redeem.
  v_json := public.open_challenge(v_code);
  v_id := (v_json->>'match_id')::uuid;
  UPDATE public.ladder_matches SET created_at = pg_catalog.now() - INTERVAL '1 minute' WHERE id = v_id;
  PERFORM public.report_ladder_result(v_id, false, false);
  v_json := public.redeem_referral(v_ref);
  IF v_json->>'ok' <> 'true' OR (v_json->>'bonus')::int <> 15 THEN
    RAISE EXCEPTION 'referral did not pay 15: %', v_json;
  END IF;
  v_json := public.redeem_referral(v_ref);
  IF v_json->>'reason' <> 'used' THEN RAISE EXCEPTION 'referral was reusable: %', v_json; END IF;

  -- Slip is public and has no deck.
  IF to_jsonb((SELECT s FROM public.slip_preview(v_id) s))::text LIKE '%deck%' THEN
    RAISE EXCEPTION 'slip leaked a deck';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.slip_preview(v_id) WHERE username = 'Ada' AND won IS FALSE) THEN
    RAISE EXCEPTION 'slip did not show the loss';
  END IF;

  v_denied := FALSE;
  BEGIN
    EXECUTE 'SET LOCAL ROLE anon';
    PERFORM public.follow_player(v_code);
  EXCEPTION WHEN insufficient_privilege THEN
    v_denied := TRUE;
  END;
  EXECUTE 'RESET ROLE';
  IF NOT v_denied THEN RAISE EXCEPTION 'anon could follow'; END IF;

  v_denied := FALSE;
  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    UPDATE public.follows SET follower = v_b WHERE follower = v_a;
  EXCEPTION WHEN insufficient_privilege THEN
    v_denied := TRUE;
  END;
  EXECUTE 'RESET ROLE';
  IF NOT v_denied THEN RAISE EXCEPTION 'authenticated could rewrite follows'; END IF;

  -- Cup: both entered, A draws one, a fourth is impossible before three, and the cap holds at 3.
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_b::text, 'role', 'authenticated')::text, true);
  PERFORM public.enter_cup();
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_a::text, 'role', 'authenticated')::text, true);
  v_json := public.enter_cup();
  IF v_json->>'ok' <> 'true' THEN RAISE EXCEPTION 'cup entry failed: %', v_json; END IF;
  v_json := public.draw_cup();
  IF v_json->>'match_id' IS NULL THEN RAISE EXCEPTION 'cup draw failed: %', v_json; END IF;

  RAISE NOTICE 'back room assertions passed';
END $$;
SQL

echo "==> Asserting retention marks: own row, allowlist, one each, rate limit, no anon"
"${PSQL[@]}" <<'SQL'
DO $$
DECLARE
  v_a    UUID := 'a71a71a7-1111-4111-8111-111111111171';
  v_b    UUID := 'b72b72b7-2222-4222-8222-222222222272';
  v_fresh BOOLEAN;
  v_rows INTEGER;
  i      INTEGER;
BEGIN
  INSERT INTO auth.users (id) VALUES (v_a), (v_b) ON CONFLICT DO NOTHING;

  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'claim_retention_mark' AND p.prosecdef
      AND EXISTS (SELECT 1 FROM unnest(p.proconfig) c WHERE c LIKE 'search_path=%')
  ) THEN
    RAISE EXCEPTION 'claim_retention_mark is not SECURITY DEFINER with a pinned search_path';
  END IF;

  IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.retention_marks'::regclass) THEN
    RAISE EXCEPTION 'RLS is not enabled on retention_marks';
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'claim_retention_mark'
      AND has_function_privilege('anon', p.oid, 'EXECUTE')
  ) THEN
    RAISE EXCEPTION 'anon can EXECUTE claim_retention_mark';
  END IF;

  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', v_a::text, 'role', 'authenticated')::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';

  BEGIN
    INSERT INTO public.retention_marks (user_id, mark) VALUES (v_a, 'plaque_10');
    RAISE EXCEPTION 'authenticated inserted a retention mark directly';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;

  BEGIN
    PERFORM claim_retention_mark('not-a-mark');
    RAISE EXCEPTION 'an unknown mark was accepted';
  EXCEPTION WHEN invalid_parameter_value THEN NULL;
  END;

  SELECT claim_retention_mark('plaque_10') INTO v_fresh;
  IF v_fresh IS NOT TRUE THEN RAISE EXCEPTION 'the first plaque mark was not fresh (%)', v_fresh; END IF;
  SELECT claim_retention_mark('plaque_10') INTO v_fresh;
  IF v_fresh IS NOT FALSE THEN RAISE EXCEPTION 'a repeat plaque mark was fresh'; END IF;

  -- Two calls so far. Eighteen more fill the window of twenty.
  FOR i IN 1..18 LOOP
    PERFORM claim_retention_mark('level_2');
  END LOOP;
  BEGIN
    PERFORM claim_retention_mark('level_3');
    RAISE EXCEPTION 'the 21st mark in a minute was allowed';
  EXCEPTION WHEN SQLSTATE 'PT429' THEN NULL;
  END;

  RESET ROLE;
  -- Count as the owner. The table has no client policy, so the role above
  -- cannot see the rows it just wrote through the function.
  SELECT count(*) INTO v_rows FROM public.retention_marks WHERE user_id = v_a AND mark = 'plaque_10';
  IF v_rows <> 1 THEN RAISE EXCEPTION 'plaque_10 was stored % times', v_rows; END IF;
  SELECT count(*) INTO v_rows FROM public.retention_marks WHERE user_id = v_a AND mark = 'level_3';
  IF v_rows <> 0 THEN RAISE EXCEPTION 'a rate-limited mark was stored'; END IF;
  SELECT count(*) INTO v_rows FROM public.retention_marks WHERE user_id = v_b;
  IF v_rows <> 0 THEN RAISE EXCEPTION 'another account received % marks', v_rows; END IF;

  RAISE NOTICE 'retention mark assertions passed';
END $$;
SQL

echo "==> Pack economy: server rolls, storage cap, crawl price"
"${PSQL[@]}" <<'SQL'
DO $$
DECLARE
  v_buyer UUID := 'a1a1a1a1-a1a1-41a1-81a1-a1a1a1a1a1a1';
  v_other UUID := 'b2b2b2b2-b2b2-42b2-82b2-b2b2b2b2b2b2';
  v_row   JSONB;
  v_gems  INTEGER;
  v_owned INTEGER;
  v_rares INTEGER;
  v_pity  INTEGER;
BEGIN
  INSERT INTO auth.users (id) VALUES (v_buyer), (v_other) ON CONFLICT DO NOTHING;
  INSERT INTO public.user_gems (user_id, gems) VALUES (v_buyer, 100)
  ON CONFLICT (user_id) DO UPDATE SET gems = 100;

  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'settle_pack_open'
      AND pg_get_function_identity_arguments(p.oid) LIKE '%integer%'
  ) THEN
    RAISE EXCEPTION 'settle_pack_open still accepts card ids';
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'settle_pack_open'
      AND has_function_privilege('anon', p.oid, 'EXECUTE')
  ) THEN
    RAISE EXCEPTION 'anon can EXECUTE settle_pack_open';
  END IF;

  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', v_buyer::text, 'role', 'authenticated')::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';

  BEGIN
    PERFORM public.settle_pack_open('pack-nonce-bad', 'regular', ARRAY[1]);
    RAISE EXCEPTION 'client card ids were accepted';
  EXCEPTION WHEN undefined_function THEN NULL;
  END;

  v_row := public.settle_pack_open('pack-nonce-1', 'regular');
  IF jsonb_array_length(v_row->'card_ids') <> 5 THEN
    RAISE EXCEPTION 'a regular pack rolled % cards', v_row->'card_ids';
  END IF;
  v_row := public.settle_pack_open('pack-nonce-1', 'legendary');
  IF (v_row->>'replay')::boolean IS NOT TRUE OR jsonb_array_length(v_row->'card_ids') <> 5 THEN
    RAISE EXCEPTION 'replay changed the roll %', v_row;
  END IF;

  RESET ROLE;
  CREATE TEMP TABLE pack_cat_bak AS SELECT id, rarity FROM public.pack_catalog;
  CREATE TEMP TABLE pack_odds_bak AS SELECT rarity, weight FROM public.pack_odds;
  UPDATE public.pack_catalog SET rarity = 'common';
  UPDATE public.pack_catalog SET rarity = 'legendary' WHERE id = 'ma-1';
  UPDATE public.pack_odds SET weight = CASE WHEN rarity = 'legendary' THEN 100 ELSE 0 END;
  INSERT INTO public.card_seasons (id, name, theme, starts_at, ends_at, card_ids, pack_weight_boost)
  VALUES ('ma-shut', 'Shut', 'test', pg_catalog.now() + interval '10 days', pg_catalog.now() + interval '20 days', ARRAY['ma-1'], 1);
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', v_buyer::text, 'role', 'authenticated')::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  v_row := public.settle_pack_open('pack-nonce-shut', 'regular');
  IF v_row->'card_ids' ? 'ma-1' THEN
    RAISE EXCEPTION 'a closed season still dropped %', v_row->'card_ids';
  END IF;
  RESET ROLE;
  DELETE FROM public.card_seasons WHERE id = 'ma-shut';
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', v_buyer::text, 'role', 'authenticated')::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  v_row := public.settle_pack_open('pack-nonce-string', 'regular');
  IF NOT (v_row->'card_ids' ? 'ma-1') THEN
    RAISE EXCEPTION 'an open string-id card was not rolled: %', v_row->'card_ids';
  END IF;
  RESET ROLE;
  IF NOT EXISTS (
    SELECT 1 FROM public.pack_owned WHERE user_id = v_buyer AND card_id = 'ma-1'
  ) THEN
    RAISE EXCEPTION 'ma-1 was rolled but not stored';
  END IF;
  UPDATE public.pack_catalog c SET rarity = b.rarity FROM pack_cat_bak b WHERE c.id = b.id;
  UPDATE public.pack_odds o SET weight = b.weight FROM pack_odds_bak b WHERE o.rarity = b.rarity;
  DROP TABLE pack_cat_bak;
  DROP TABLE pack_odds_bak;

  DELETE FROM public.pack_owned WHERE user_id = v_buyer;
  INSERT INTO public.pack_owned (user_id, card_id)
  SELECT v_buyer, id FROM public.pack_catalog ORDER BY id LIMIT 36;
  UPDATE public.pack_wallet SET wins = 0 WHERE user_id = v_buyer;
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', v_buyer::text, 'role', 'authenticated')::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  PERFORM public.settle_pack_open('pack-nonce-cap', 'regular');
  RESET ROLE;
  SELECT count(*) INTO v_owned FROM public.pack_owned WHERE user_id = v_buyer;
  IF v_owned <> 36 THEN RAISE EXCEPTION 'storage cap let the binder grow to %', v_owned; END IF;

  UPDATE public.pack_odds SET weight = CASE WHEN rarity = 'common' THEN 100 ELSE 0 END;
  UPDATE public.pack_wallet SET pity = 9 WHERE user_id = v_buyer;
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', v_buyer::text, 'role', 'authenticated')::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  v_row := public.settle_pack_open('pack-nonce-pity', 'regular');
  RESET ROLE;
  SELECT count(*) INTO v_rares FROM public.pack_catalog
  WHERE id = ANY (ARRAY(SELECT jsonb_array_elements_text(v_row->'card_ids')))
    AND rarity = 'rare';
  IF v_rares < 1 THEN RAISE EXCEPTION 'pity did not place a rare: %', v_row; END IF;
  SELECT pity INTO v_pity FROM public.pack_wallet WHERE user_id = v_buyer;
  IF v_pity <> 0 THEN RAISE EXCEPTION 'pity did not reset: %', v_pity; END IF;
  UPDATE public.pack_odds SET weight = CASE rarity
    WHEN 'legendary' THEN 1 WHEN 'epic' THEN 5 WHEN 'rare' THEN 15
    WHEN 'uncommon' THEN 30 ELSE 49 END;

  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', v_buyer::text, 'role', 'authenticated')::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  BEGIN
    PERFORM public.buy_convenience('conv-no-walk', 'crawl_skip');
    RAISE EXCEPTION 'a skip with no walk was charged';
  EXCEPTION WHEN SQLSTATE 'PT403' THEN NULL;
  END;
  v_row := public.buy_convenience('conv-nonce-1', 'instant_open');
  IF (v_row->>'charged')::int <> 80 OR (v_row->>'balance')::int <> 20 THEN
    RAISE EXCEPTION 'instant open priced %', v_row;
  END IF;
  v_row := public.buy_convenience('conv-nonce-1', 'instant_open');
  IF (v_row->>'replay')::boolean IS NOT TRUE OR (v_row->>'charged')::int <> 0 THEN
    RAISE EXCEPTION 'shortcut replay charged again %', v_row;
  END IF;
  BEGIN
    PERFORM public.buy_convenience('conv-nonce-2', 'instant_open');
    RAISE EXCEPTION 'instant open was sold twice';
  EXCEPTION WHEN SQLSTATE 'PT403' THEN NULL;
  END;

  RESET ROLE;
  UPDATE public.pack_wallet
     SET crawl_gate_until = pg_catalog.now() + interval '2 hours'
   WHERE user_id = v_buyer;
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', v_buyer::text, 'role', 'authenticated')::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  v_row := public.buy_convenience('conv-nonce-crawl', 'crawl_skip');
  IF (v_row->>'charged')::int <> 2 THEN
    RAISE EXCEPTION 'a two-hour walk cost %', v_row;
  END IF;
  BEGIN
    PERFORM public.buy_convenience('conv-nonce-3', 'cash_out');
    RAISE EXCEPTION 'a cash-out sku was accepted';
  EXCEPTION WHEN invalid_parameter_value THEN NULL;
  END;

  RESET ROLE;
  SELECT gems INTO v_gems FROM public.user_gems WHERE user_id = v_buyer;
  IF v_gems <> 18 THEN RAISE EXCEPTION 'gems should be 100-80-2, got %', v_gems; END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'user_gems' AND column_name = 'withdrawable'
  ) THEN
    RAISE EXCEPTION 'gems grew a withdrawable balance';
  END IF;

  UPDATE public.user_gems SET gems = 40 WHERE user_id = v_buyer;
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', v_buyer::text, 'role', 'authenticated')::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  PERFORM public.buy_convenience('reroll-1', 'quest_reroll');
  PERFORM public.buy_convenience('reroll-2', 'quest_reroll');
  PERFORM public.buy_convenience('reroll-3', 'quest_reroll');
  BEGIN
    PERFORM public.buy_convenience('reroll-4', 'quest_reroll');
    RAISE EXCEPTION 'a fourth reroll cleared the daily cap';
  EXCEPTION WHEN SQLSTATE 'PT429' THEN NULL;
  END;
  RESET ROLE;

  RAISE NOTICE 'pack economy assertions passed';
END $$;
SQL

echo "==> Migrations apply cleanly and the security properties hold"

# Every card the client can roll has a catalog row. A future set that is
# only in the client fails here until its migration adds the rows.
client_ids="$(node --input-type=module <<'NODE'
import { readFileSync, readdirSync } from 'node:fs';
const files = ['src/stores/gameStore.js', ...readdirSync('src/data').map((n) => `src/data/${n}`)];
const ids = new Set();
const pat = /\{\s*id:\s*(\d+|'[^']+')[\s\S]*?rarity:\s*'(\w+)'/g;
for (const f of files) {
  const src = readFileSync(f, 'utf8');
  for (const m of src.matchAll(pat)) ids.add(m[1].replace(/'/g, ''));
}
process.stdout.write([...ids].sort().join('\n'));
NODE
)"
server_ids="$(psql "$DB" -tA -c "SELECT id FROM public.pack_catalog ORDER BY id")"
missing="$(comm -23 <(printf '%s\n' "$client_ids") <(printf '%s\n' "$server_ids"))"
if [ -n "$missing" ]; then
  echo "pack_catalog is missing client card ids:" >&2
  printf '%s\n' "$missing" >&2
  exit 1
fi
echo "==> pack_catalog holds every client card id"
