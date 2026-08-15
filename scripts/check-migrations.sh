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
  FOR fn IN SELECT unnest(ARRAY['add_user_gems','fulfill_gem_purchase','reverse_gem_purchase','cleanup_rate_limits'])
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

  -- Clients must not hold any write privilege on players.
  IF EXISTS (
    SELECT 1 FROM information_schema.role_table_grants
    WHERE table_name = 'players' AND grantee IN ('anon','authenticated')
      AND privilege_type IN ('INSERT','UPDATE','DELETE','TRUNCATE')
  ) THEN bad := bad || '  anon/authenticated still hold a write grant on players' || chr(10); END IF;

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

echo "==> Migrations apply cleanly and the security properties hold"
