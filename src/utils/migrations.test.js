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
});
