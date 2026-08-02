// Shared hermetic-session setup for the Playwright suites.
//
// Fully hermetic: a fake Supabase session is seeded into localStorage before
// the app boots (supabase-js restores it from the `sb-<ref>-auth-token` key),
// and every request to the fake Supabase project, the sound CDN, and PostHog
// is stubbed or aborted in the browser. No real backend is contacted.
//
// Factored out of e2e/smoke.spec.js so e2e/a11y.spec.js (and any future spec)
// can reuse the exact same boot without duplicating it or drifting from it.
import { test as base, expect } from '@playwright/test';

export const REF = 'testproject'; // first host label of VITE_SUPABASE_URL

const b64url = (obj) => Buffer.from(JSON.stringify(obj)).toString('base64url');
const FAKE_JWT = [
  b64url({ alg: 'HS256', typ: 'JWT' }),
  b64url({ sub: '11111111-1111-4111-8111-111111111111', role: 'authenticated', exp: 4102444800 }),
  'sig',
].join('.');

export const SESSION = {
  access_token: FAKE_JWT,
  token_type: 'bearer',
  expires_in: 3600 * 24 * 365,
  expires_at: 4102444800,
  refresh_token: 'fake-refresh',
  user: {
    id: '11111111-1111-4111-8111-111111111111',
    aud: 'authenticated',
    role: 'authenticated',
    email: 'qa@example.com',
    email_confirmed_at: '2026-01-01T00:00:00Z',
    app_metadata: { provider: 'email' },
    user_metadata: {},
    created_at: '2026-01-01T00:00:00Z',
  },
};

// Generous ceiling for lazy-loaded dialogs and battle animations.
export const SLOW = { timeout: 30_000 };

// `test` extended with the same auto-collected page-error fixture the smoke
// suite asserts against, so any spec importing this can reuse it too.
export const test = base.extend({
  pageErrors: [
    async ({ page }, use) => {
      const errors = [];
      page.on('pageerror', (err) => errors.push(err));
      await use(errors);
    },
    { auto: true },
  ],
});

// Stubs the fake Supabase project + sound CDN + analytics, seeds the fake
// auth session and a deterministic game store, then boots the app and waits
// for the main menu. Call from a `test.beforeEach`.
export async function bootToMainMenu(page) {
  await page.route('**testproject.supabase.co/**', (route) => {
    const url = route.request().url();
    if (url.includes('/auth/v1/user')) return route.fulfill({ json: SESSION.user });
    if (url.includes('/auth/v1/')) return route.fulfill({ json: SESSION });
    if (url.includes('/rest/v1/rpc/')) return route.fulfill({ json: null });
    if (url.includes('/rest/v1/')) return route.fulfill({ json: [] });
    return route.fulfill({ json: {} });
  });
  await page.route('**assets.mixkit.co/**', (r) => r.abort());
  await page.route('https://*.posthog.com/**', (r) => r.abort());

  // lastLoginDate=today and tutorialCompleted=true suppress the first-run
  // Daily Rewards / Tutorial modals so tests land on the main menu.
  await page.addInitScript(
    ([authKey, session]) => {
      localStorage.setItem(authKey, JSON.stringify(session));
      localStorage.setItem(
        'terrible-teddies-storage',
        JSON.stringify({
          state: {
            tutorialCompleted: true,
            lastLoginDate: new Date().toDateString(),
            playerName: 'QA Bear',
            coins: 1234,
            gems: 56,
          },
          version: 3,
        })
      );
    },
    [`sb-${REF}-auth-token`, SESSION]
  );

  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Battle', exact: true })).toBeVisible(SLOW);
}

export { expect };
