import { fileURLToPath, URL } from 'url';
import { defineConfig, configDefaults } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    // jsdom gives the store's persist middleware a real localStorage to write to.
    environment: 'jsdom',
    // ...except under Node >= 26, whose built-in localStorage global shadows
    // jsdom's and resolves to undefined without --localstorage-file. See
    // vitest.setup.js.
    setupFiles: ['./vitest.setup.js'],
    globals: true,
    // The second pattern is the Stripe webhook's decision layer. It lives under
    // supabase/functions/ beside the Deno code it serves, but it is plain JS
    // with no Deno or network imports precisely so this suite can reach it —
    // there is no Deno in CI, and that money path had no test of any kind.
    include: ['src/**/*.{test,spec}.{js,jsx}', 'supabase/functions/**/*.{test,spec}.js'],
    // Profiling/audit agents write throwaway probe suites under dunder dirs
    // (src/__probe__/, src/__perf_tmp__/) to take measurements. Those match the
    // include glob above, so a stray one silently joins the real suite —
    // verified: adding one file took the run from 19/320 to 20/321. Gitignoring
    // them stops them being committed but not collected, since vitest globs the
    // filesystem, not the index. Spreading configDefaults keeps vitest's own
    // exclusions (node_modules, dist, ...) which a bare array would replace.
    exclude: [...configDefaults.exclude, 'src/__*__/**'],
    restoreMocks: true,
  },
});
