// Guards against a migration referencing a table (via foreign key) that no
// migration ever creates. This exact bug shipped once: the oldest migration
// (applied first, before every other migration) referenced tables from an
// abandoned prototype schema that were never created anywhere — `supabase db
// push` would fail on migration #1 and none of the real, hardened migrations
// (players/purchases/user_gems/RLS/rate-limiting) would ever apply.
import { readdirSync, readFileSync } from 'fs';
import { resolve } from 'path';

const MIGRATIONS_DIR = resolve(process.cwd(), 'supabase/migrations');

// Schemas Supabase/Postgres provides out of the box — migrations may
// reference these without ever creating them.
const BUILTIN_SCHEMAS = new Set(['auth', 'storage', 'realtime', 'vault']);

function loadMigrations() {
  return readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort() // filename timestamp prefix == application order
    .map((f) => ({ file: f, sql: readFileSync(resolve(MIGRATIONS_DIR, f), 'utf8') }));
}

function createdTables(sql) {
  const names = new Set();
  const re = /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?"?(?:public\.)?"?(\w+)"?/gi;
  let m;
  while ((m = re.exec(sql))) names.add(m[1].toLowerCase());
  return names;
}

function rlsEnabledTables(sql) {
  const names = new Set();
  const re = /ALTER\s+TABLE\s+(?:IF\s+EXISTS\s+)?"?(?:public\.)?"?(\w+)"?\s+ENABLE\s+ROW\s+LEVEL\s+SECURITY/gi;
  let m;
  while ((m = re.exec(sql))) names.add(m[1].toLowerCase());
  return names;
}

function referencedTables(sql) {
  // Matches `REFERENCES table_name` / `REFERENCES public.table_name` /
  // `REFERENCES schema.table_name`, capturing an optional schema qualifier.
  const refs = [];
  const re = /REFERENCES\s+"?(\w+)"?\.?"?(\w*)"?\s*\(/gi;
  let m;
  while ((m = re.exec(sql))) {
    const [, first, second] = m;
    const schema = second ? first.toLowerCase() : 'public';
    const table = (second || first).toLowerCase();
    refs.push({ schema, table });
  }
  return refs;
}

describe('supabase migrations reference only tables that get created', () => {
  it('found a plausible number of migration files', () => {
    expect(loadMigrations().length).toBeGreaterThanOrEqual(5);
  });

  it('every foreign-key reference resolves to a table created by some migration (or a builtin schema)', () => {
    const migrations = loadMigrations();
    const allCreated = new Set();
    for (const { sql } of migrations) {
      for (const t of createdTables(sql)) allCreated.add(t);
    }

    const problems = [];
    for (const { file, sql } of migrations) {
      for (const { schema, table } of referencedTables(sql)) {
        if (BUILTIN_SCHEMAS.has(schema)) continue;
        if (!allCreated.has(table)) {
          problems.push(`${file}: REFERENCES ${schema}.${table} — never created by any migration`);
        }
      }
    }

    expect(problems, problems.join('\n')).toEqual([]);
  });

  it('every public table created has RLS enabled somewhere in the migration set', () => {
    // rate_limits shipped once without RLS — the only thing gating the Stripe
    // checkout endpoint against spam was directly readable/writable via
    // PostgREST's default grants, letting a client reset its own rate-limit
    // window through the table instead of the guarded RPC. Every table in
    // this schema follows the same convention (RLS enabled, even if with a
    // deny-all zero-policy set for internal-only tables), so require it
    // uniformly rather than trusting each new migration to remember.
    const migrations = loadMigrations();
    const created = new Set();
    const rlsEnabled = new Set();
    for (const { sql } of migrations) {
      for (const t of createdTables(sql)) created.add(t);
      for (const t of rlsEnabledTables(sql)) rlsEnabled.add(t);
    }

    const missing = [...created].filter((t) => !rlsEnabled.has(t));
    expect(missing, `tables created without RLS ever enabled: ${missing.join(', ')}`).toEqual([]);
  });

  it('every SECURITY DEFINER function granted to authenticated validates the caller with auth.uid()', () => {
    // check_rate_limit shipped as SECURITY DEFINER + GRANT ... TO authenticated
    // with a caller-supplied p_user_id and NO auth.uid() check, so any logged-in
    // user could burn another user's rate limit (a DoS on the checkout path) —
    // the one sibling of upsert_player_profile/sync_battle_result/sync_player_level
    // that the auth-guard migration forgot. Any SECURITY DEFINER function that
    // authenticated clients can invoke and that takes a user id must gate on
    // auth.uid(); the latest CREATE OR REPLACE of each function is what counts.
    const migrations = loadMigrations();

    // Track, per function name, the SQL of its most recent definition and
    // whether it was ever granted to the authenticated role.
    const latestDef = new Map(); // name -> function body sql
    const grantedToAuthenticated = new Set();

    const defRe = /CREATE\s+OR\s+REPLACE\s+FUNCTION\s+(?:public\.)?(\w+)\s*\(([\s\S]*?)\)\s*RETURNS[\s\S]*?\$\$([\s\S]*?)\$\$/gi;
    const grantRe = /GRANT\s+EXECUTE\s+ON\s+FUNCTION\s+(?:public\.)?(\w+)\s*\([^)]*\)\s+TO\s+([^;]+);/gi;

    for (const { sql } of migrations) {
      let m;
      while ((m = defRe.exec(sql))) {
        const [, name, params, body] = m;
        // Later migrations override earlier definitions (application order).
        latestDef.set(name.toLowerCase(), { params, body });
      }
      let g;
      while ((g = grantRe.exec(sql))) {
        const [, name, roles] = g;
        if (/\bauthenticated\b/.test(roles)) grantedToAuthenticated.add(name.toLowerCase());
      }
    }

    const problems = [];
    for (const name of grantedToAuthenticated) {
      const def = latestDef.get(name);
      if (!def) continue; // grant with no CREATE OR REPLACE in-repo — skip
      // Only functions that accept a user-id parameter can be abused cross-user.
      const takesUserId = /\bp_user_id\s+UUID\b/i.test(def.params);
      if (!takesUserId) continue;
      if (!/auth\.uid\(\)/.test(def.body)) {
        problems.push(`${name}: SECURITY DEFINER, granted to authenticated, takes p_user_id, but its latest definition has no auth.uid() check`);
      }
    }

    expect(problems, problems.join('\n')).toEqual([]);
  });

  it('every live SECURITY DEFINER function pins its search_path', () => {
    // A SECURITY DEFINER function with a mutable search_path (Supabase's
    // `function_search_path_mutable` lint) can have its unqualified table/
    // function references redirected by a caller who can create a shadowing
    // object earlier in the resolved path. Every definer function here reads
    // money-/leaderboard-adjacent tables unqualified, so require each to pin its
    // search_path — inline (SET search_path in the CREATE) or via ALTER FUNCTION.
    const migrations = loadMigrations();

    // name -> { isDefiner, hasInlineSearchPath } for the LATEST definition.
    const latestDef = new Map();
    const dropped = new Set();       // DROP FUNCTION name(...)
    const alteredSearchPath = new Set(); // ALTER FUNCTION name(...) SET search_path

    const defRe = /CREATE\s+OR\s+REPLACE\s+FUNCTION\s+(?:public\.)?(\w+)\s*\(([\s\S]*?)\)\s*RETURNS([\s\S]*?)\$\$/gi;
    const dropRe = /DROP\s+FUNCTION\s+(?:IF\s+EXISTS\s+)?(?:public\.)?(\w+)\s*\(/gi;
    const alterRe = /ALTER\s+FUNCTION\s+(?:public\.)?(\w+)\s*\([^)]*\)[\s\S]*?SET\s+search_path/gi;

    for (const { sql } of migrations) {
      let m;
      while ((m = defRe.exec(sql))) {
        const [, name, , header] = m; // header spans RETURNS..$$ (holds SECURITY DEFINER / SET search_path)
        latestDef.set(name.toLowerCase(), {
          isDefiner: /SECURITY\s+DEFINER/i.test(header),
          hasInlineSearchPath: /SET\s+search_path/i.test(header),
        });
      }
      let d;
      while ((d = dropRe.exec(sql))) dropped.add(d[1].toLowerCase());
      let a;
      while ((a = alterRe.exec(sql))) alteredSearchPath.add(a[1].toLowerCase());
    }

    const problems = [];
    for (const [name, def] of latestDef) {
      if (dropped.has(name) || !def.isDefiner) continue;
      if (def.hasInlineSearchPath || alteredSearchPath.has(name)) continue;
      problems.push(`${name}: SECURITY DEFINER but never pins SET search_path (inline or via ALTER FUNCTION)`);
    }

    expect(problems, problems.join('\n')).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Money-path RPC exposure.
//
// The bug this exists to prevent: every gem-minting SECURITY DEFINER function
// guarded itself with `IF auth.uid() IS NOT NULL THEN RAISE`, treating "no
// authenticated user" as "must be the service-role webhook". The `anon` role
// also has a NULL auth.uid(), so anon sailed through. The GRANTs did not save
// it either — the revokes named `public` and `authenticated` but never `anon`,
// and Supabase's default privileges give every new function a DIRECT anon
// EXECUTE grant that `REVOKE ... FROM public` does not remove. The anon key is
// public by design (it ships in the client bundle), so this was free gems.
// ---------------------------------------------------------------------------
describe('money-path RPCs are not reachable with the anon key', () => {
  const migrations = loadMigrations();
  const allSql = migrations.map((m) => m.sql).join('\n');

  // Functions that mint, move, or gate paid currency and the checkout limiter.
  const SENSITIVE = [
    'add_user_gems',
    'fulfill_gem_purchase',
    'reverse_gem_purchase',
    'check_rate_limit',
    'cleanup_rate_limits',
  ];

  // Every REVOKE ... FROM <roles> in the whole migration set, as
  // { fn -> Set(roles) }. Roles may be a comma-separated list.
  function revokedRoles(fn) {
    const re = new RegExp(
      `REVOKE\\s+EXECUTE\\s+ON\\s+FUNCTION\\s+(?:public\\.)?${fn}\\s*\\([^)]*\\)\\s*FROM\\s+([^;]+);`,
      'gi'
    );
    const roles = new Set();
    let m;
    while ((m = re.exec(allSql))) {
      for (const r of m[1].split(',')) roles.add(r.trim().toLowerCase());
    }
    return roles;
  }

  it.each(SENSITIVE)('%s explicitly revokes EXECUTE from anon', (fn) => {
    const roles = revokedRoles(fn);
    expect(
      roles.has('anon'),
      `${fn} never appears in a "REVOKE EXECUTE ... FROM anon". Revoking only ` +
        `public is not enough: Supabase's default privileges grant EXECUTE on new ` +
        `functions directly to anon, and a direct grant survives REVOKE FROM public.`
    ).toBe(true);
  });

  // The guard itself must be a positive assertion. `auth.uid() IS NOT NULL` is
  // the exact negative form that let anon through, so the final definition of
  // each server-only function must not still rely on it alone.
  const SERVER_ONLY = ['add_user_gems', 'fulfill_gem_purchase', 'reverse_gem_purchase', 'cleanup_rate_limits'];

  function finalBody(fn) {
    const re = new RegExp(
      `CREATE\\s+OR\\s+REPLACE\\s+FUNCTION\\s+(?:public\\.)?${fn}\\s*\\([\\s\\S]*?\\$\\$([\\s\\S]*?)\\$\\$;`,
      'gi'
    );
    let last = null;
    let m;
    // Migrations are sorted by filename, so the last match is the live definition.
    while ((m = re.exec(allSql))) last = m[1];
    return last;
  }

  it.each(SERVER_ONLY)('%s asserts the caller IS service_role, not merely "not logged in"', (fn) => {
    const body = finalBody(fn);
    expect(body, `no CREATE OR REPLACE FUNCTION body found for ${fn}`).toBeTruthy();
    expect(
      /is_service_role\s*\(\s*\)/i.test(body),
      `${fn}'s live definition does not call is_service_role(). A negative guard ` +
        `("auth.uid() IS NOT NULL") passes for the anon role, whose auth.uid() is ` +
        `also NULL — that is the hole. Assert the caller IS service_role instead.`
    ).toBe(true);
  });

  it('is_service_role treats anon as a client, not as the server', () => {
    const body = finalBody('is_service_role');
    expect(body, 'is_service_role() is not defined in any migration').toBeTruthy();
    // It must key off the request's role claim, and service_role must be the
    // thing it looks for — not merely the absence of a user.
    expect(/request\.jwt\.claims/i.test(body)).toBe(true);
    expect(/service_role/i.test(body)).toBe(true);
    expect(
      /auth\.uid\s*\(\s*\)/i.test(body),
      'is_service_role must not fall back to auth.uid() — that is the flawed signal it replaces'
    ).toBe(false);
  });
});
