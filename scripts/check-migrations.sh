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

echo "==> Migrations apply cleanly and the security properties hold"
