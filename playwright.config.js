import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright end-to-end smoke suite.
 *
 * The suite is fully hermetic: the Supabase URL/key below point at a fake
 * project, and every network call to it is stubbed inside the tests
 * (see e2e/smoke.spec.js), so no .env file or real backend is needed.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:8090',
    trace: 'off',
    // The app honors this via <MotionConfig reducedMotion="user">, so parallel
    // workers run without the continuous Framer Motion animations — lighter CPU
    // and a smaller animation-timing surface for the auto-waiting assertions.
    reducedMotion: 'reduce',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    // Port 8090 on IPv4 — the repo's default dev port (8080) may be in use.
    //
    // E2E_PREVIEW=1 serves a prebuilt dist/ via `vite preview` instead of the
    // dev server, so the suite also exercises the minified production bundle
    // (a prod-only break — chunking, minification, a stale CSP — is otherwise
    // invisible: dev-server e2e never runs the build output). The build must be
    // done first with the VITE_ vars below baked in; `vite preview` reads those
    // baked values, so the env block here only affects the dev-server path.
    command: process.env.E2E_PREVIEW
      ? 'npx vite preview --host 127.0.0.1 --port 8090'
      : 'npx vite --host 127.0.0.1 --port 8090',
    url: 'http://127.0.0.1:8090',
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      VITE_SUPABASE_URL: 'https://testproject.supabase.co',
      VITE_SUPABASE_ANON_KEY: 'test-anon-key',
    },
  },
});
