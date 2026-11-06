// Shared hermetic-session setup for the Playwright suites.
//
// Fully hermetic: a fake Supabase session is seeded into localStorage before
// the app boots (supabase-js restores it from the `sb-<ref>-auth-token` key),
// and every request to the fake Supabase project and to PostHog is stubbed or
// aborted in the browser. Sounds, card art and fonts are the app's own files,
// served with it (src/utils/sounds.test.js fails on an external sound URL).
// No real backend is contacted.
//
// Factored out of e2e/smoke.spec.js so e2e/a11y.spec.js (and any future spec)
// can reuse the exact same boot without duplicating it or drifting from it.
import { test as base, expect } from '@playwright/test';
// The door's storage contract, from the same pure module the app reads it with.
import { DOOR_KEY, doorRecord } from '../../src/lib/door.js';

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
//
// And with the door. A device that has never answered the adults-only door
// (src/components/TheDoor.jsx) sees nothing else, so every spec's context is
// seeded with a pass before any page loads (a context-level init script: it
// reaches the specs that boot themselves, and the pages they open, which
// bootToMainMenu alone would not). It is written only where there is no
// record yet, so an answer the app has stored since is never overwritten by a
// reload. e2e/door.spec.js turns it off with `test.use({ doorPassed: false })`
// to meet the door as a new device does. Contexts a spec makes for itself
// with browser.newContext() are not seeded: they are new devices.
export const test = base.extend({
  doorPassed: [true, { option: true }],
  context: async ({ context, doorPassed }, use) => {
    if (doorPassed) {
      await context.addInitScript(([key, value]) => {
        try {
          if (localStorage.getItem(key) === null) localStorage.setItem(key, value);
        } catch {
          // No storage to write to (about:blank, blocked): the page is not one that reads it.
        }
      }, [DOOR_KEY, doorRecord('pass', 0)]);
    }
    await use(context);
  },
  // The opening mulligan sits in front of turn 1. Specs that start a fight
  // wait for End Turn, which is the turn after Keep hand. This presses Keep
  // whenever it is up, so those specs still land on the fight. A spec that
  // wants the mulligan itself can click before this poll, or not use it.
  page: async ({ page }, use) => {
    let stopped = false;
    const timer = setInterval(() => {
      if (stopped) return;
      const keep = page.getByRole('button', { name: 'Keep hand' });
      keep.isVisible().then((visible) => {
        if (visible && !stopped) return keep.click({ timeout: 1000 }).catch(() => {});
        return undefined;
      }).catch(() => {});
    }, 150);
    await use(page);
    stopped = true;
    clearInterval(timer);
  },
  pageErrors: [
    async ({ page }, use) => {
      const errors = [];
      page.on('pageerror', (err) => errors.push(err));
      await use(errors);
    },
    { auto: true },
  ],
});

// Stubs every request to the fake Supabase project (answering as a signed-in
// player's backend would) and aborts PostHog's.
export async function stubSupabase(page) {
  await page.route('**testproject.supabase.co/**', (route) => {
    const url = route.request().url();
    if (url.includes('/auth/v1/user')) return route.fulfill({ json: SESSION.user });
    if (url.includes('/auth/v1/')) return route.fulfill({ json: SESSION });
    if (url.includes('/rest/v1/rpc/')) return route.fulfill({ json: null });
    if (url.includes('/rest/v1/')) return route.fulfill({ json: [] });
    return route.fulfill({ json: {} });
  });
  await page.route('https://*.posthog.com/**', (r) => r.abort());
}

// Seeds the fake auth session and a deterministic game store for the next
// load. lastLoginDate=today and tutorialCompleted=true suppress the first-run
// Daily Rewards / Tutorial modals so tests land on the main menu.
export async function seedSignedIn(page) {
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
}

// Stubs the fake Supabase project + analytics, seeds the fake
// auth session and a deterministic game store, then boots the app and waits
// for the main menu. Call from a `test.beforeEach`.
export async function bootToMainMenu(page) {
  await stubSupabase(page);
  await seedSignedIn(page);

  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Battle', exact: true })).toBeVisible(SLOW);
}

export { expect };
