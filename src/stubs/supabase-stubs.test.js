import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import * as realtimeStub from './supabase-realtime.js';
import * as storageStub from './supabase-storage.js';

// vite.config.js aliases @supabase/realtime-js and @supabase/storage-js to the
// stubs in this directory, to keep ~85 kB of unused websocket and file-storage
// code out of the entry chunk.
//
// That trade is only safe while the stubs satisfy everything supabase-js
// actually imports from those packages. A supabase-js upgrade that reaches for
// a new export would fail at BUILD time (missing binding), but one that calls a
// new METHOD on RealtimeClient would fail at RUNTIME — on the auth path, which
// the e2e suite cannot catch because it stubs the network. So this reads the
// installed supabase-js and pins both surfaces against it.
const SUPABASE_ENTRY = 'node_modules/@supabase/supabase-js/dist/index.mjs';

const source = (() => {
  try {
    return readFileSync(resolve(process.cwd(), SUPABASE_ENTRY), 'utf8');
  } catch {
    return null;
  }
})();

describe('supabase realtime/storage stubs still cover what supabase-js needs', () => {
  it('found the installed supabase-js entry to check against', () => {
    expect(source, `${SUPABASE_ENTRY} not found — did the package layout change?`).toBeTruthy();
  });

  it('exports every binding supabase-js imports from the aliased packages', () => {
    const importsFrom = (pkg) => {
      const re = new RegExp(`import\\s*\\{([^}]*)\\}\\s*from\\s*["']${pkg}["']`, 'g');
      const names = [];
      let m;
      while ((m = re.exec(source))) {
        names.push(...m[1].split(',').map((n) => n.trim().split(/\s+as\s+/)[0]).filter(Boolean));
      }
      return [...new Set(names)];
    };

    for (const [pkg, stub] of [
      ['@supabase/realtime-js', realtimeStub],
      ['@supabase/storage-js', storageStub],
    ]) {
      const needed = importsFrom(pkg);
      expect(needed.length, `parsed no imports from ${pkg} — regex drift?`).toBeGreaterThan(0);
      for (const name of needed) {
        expect(
          typeof stub[name],
          `supabase-js imports { ${name} } from ${pkg}, but the stub at ` +
            `src/stubs/ does not export it. Add it, or drop the alias in vite.config.js.`
        ).not.toBe('undefined');
      }
    }
  });

  it('provides every RealtimeClient method supabase-js calls', () => {
    // These are invoked on the live client — setAuth in particular runs on
    // every auth state change — so a missing one is a production-only crash.
    const called = [...new Set(
      [...source.matchAll(/this\.realtime\.([a-zA-Z]+)/g)].map((m) => m[1])
    )];
    expect(called.length, 'parsed no this.realtime.* calls — regex drift?').toBeGreaterThan(0);

    const instance = new realtimeStub.RealtimeClient();
    for (const method of called) {
      expect(
        typeof instance[method],
        `supabase-js calls realtime.${method}(), which the stub does not implement.`
      ).toBe('function');
    }
  });

  it('constructs silently, because supabase-js builds both eagerly', () => {
    // Both are constructed in the SupabaseClient constructor, so a throwing
    // constructor would break every client creation, not just unused features.
    expect(() => new realtimeStub.RealtimeClient()).not.toThrow();
    expect(() => new storageStub.StorageClient()).not.toThrow();
    // setAuth is on the auth path and must be a silent no-op.
    expect(() => new realtimeStub.RealtimeClient().setAuth('token')).not.toThrow();
  });

  it('still fails loudly if the app ever actually uses these features', () => {
    expect(() => new realtimeStub.RealtimeClient().channel('x')).toThrow(/not bundled/i);
    expect(() => new storageStub.StorageClient().from('bucket')).toThrow(/not bundled/i);
  });
});
