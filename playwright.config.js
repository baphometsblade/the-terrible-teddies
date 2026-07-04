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
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    // Port 8090 on IPv4 — the repo's default dev port (8080) may be in use.
    command: 'npx vite --host 127.0.0.1 --port 8090',
    url: 'http://127.0.0.1:8090',
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      VITE_SUPABASE_URL: 'https://testproject.supabase.co',
      VITE_SUPABASE_ANON_KEY: 'test-anon-key',
    },
  },
});
