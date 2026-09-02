// Boot-gate resilience: what a returning player sees when the backend cannot
// be reached at launch.
//
// This spec deliberately does NOT use bootToMainMenu — the whole point is the
// window before the main menu exists.
import AxeBuilder from '@axe-core/playwright';
import { test, expect, REF, SESSION, SLOW } from './helpers/session.js';

const AXE_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

// Every returning player's stored access token is expired — Supabase issues
// them with a one-hour life — so restoring a session means a network refresh.
// That is what makes this the ORDINARY relaunch path rather than a corner case.
const EXPIRED = {
  ...SESSION,
  expires_at: Math.floor(Date.now() / 1000) - 3600,
  expires_in: -3600,
};

const seedExpiredSession = (page) =>
  page.addInitScript(
    ([key, value]) => localStorage.setItem(key, JSON.stringify(value)),
    [`sb-${REF}-auth-token`, EXPIRED]
  );

test('an unreachable backend explains itself instead of showing a silent spinner', async ({ page }) => {
  // Measured before this guard existed: 8 refresh attempts over ~50 seconds
  // with nothing on screen but a bouncing bear, ending at the login screen —
  // so the player waited without explanation and was then told, in effect,
  // that they were signed out.
  await page.route('**testproject.supabase.co/**', (r) => r.abort('connectionrefused'));
  await page.route('https://*.posthog.com/**', (r) => r.abort());
  await seedExpiredSession(page);

  await page.goto('/');
  await expect(page.getByText('Loading Terrible Teddies...')).toBeVisible();

  // It says what is happening...
  await expect(page.getByText(/still trying to reach the server/i)).toBeVisible(SLOW);

  // ...and eventually offers something to do about it.
  const reload = page.getByRole('button', { name: 'Reload' });
  await expect(reload).toBeVisible(SLOW);

  // The escalated state is a real screen, so it gets the same axe treatment
  // every other screen gets — it is the one screen a player on a bad
  // connection sees the longest.
  const results = await new AxeBuilder({ page }).withTags(AXE_TAGS).analyze();
  expect(
    results.violations.map((v) => `${v.id}: ${v.nodes.length} node(s)`).join('\n')
  ).toBe('');
});

test('a connection that comes back mid-retry still boots into the game', async ({ page }) => {
  // supabase-js retries the refresh with a back-off, so the right behaviour
  // while it does is to wait, not to bail out to the login screen. This pins
  // that the explanatory copy does not change the outcome.
  let down = true;
  await page.route('**testproject.supabase.co/**', (route) => {
    if (down) return route.abort('connectionrefused');
    const url = route.request().url();
    if (url.includes('/auth/v1/user')) return route.fulfill({ json: SESSION.user });
    if (url.includes('/auth/v1/')) return route.fulfill({ json: SESSION });
    if (url.includes('/rest/v1/rpc/')) return route.fulfill({ json: null });
    return route.fulfill({ json: [] });
  });
  await page.route('https://*.posthog.com/**', (r) => r.abort());
  await seedExpiredSession(page);

  await page.goto('/');
  await expect(page.getByText(/still trying to reach the server/i)).toBeVisible(SLOW);

  down = false;
  await expect(page.getByRole('button', { name: 'Battle', exact: true })).toBeVisible(SLOW);
});
