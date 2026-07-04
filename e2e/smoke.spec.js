// End-to-end smoke tests for Terrible Teddies.
//
// Fully hermetic: a fake Supabase session is seeded into localStorage before
// the app boots (supabase-js restores it from the `sb-<ref>-auth-token` key),
// and every request to the fake Supabase project, the sound CDN, and PostHog
// is stubbed or aborted in the browser. No real backend is contacted.
import { test as base, expect } from '@playwright/test';

const REF = 'testproject'; // first host label of VITE_SUPABASE_URL

const b64url = (obj) => Buffer.from(JSON.stringify(obj)).toString('base64url');
const FAKE_JWT = [
  b64url({ alg: 'HS256', typ: 'JWT' }),
  b64url({ sub: '11111111-1111-4111-8111-111111111111', role: 'authenticated', exp: 4102444800 }),
  'sig',
].join('.');

const SESSION = {
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
const SLOW = { timeout: 30_000 };

const test = base.extend({
  // Collected window "pageerror" events — tests assert none occurred.
  // auto: true guarantees the listener is attached before beforeEach navigates.
  pageErrors: [
    async ({ page }, use) => {
      const errors = [];
      page.on('pageerror', (err) => errors.push(err));
      await use(errors);
    },
    { auto: true },
  ],
});

test.beforeEach(async ({ page }) => {
  // Answer everything aimed at the fake Supabase project locally.
  await page.route('**testproject.supabase.co/**', (route) => {
    const url = route.request().url();
    if (url.includes('/auth/v1/user')) return route.fulfill({ json: SESSION.user });
    if (url.includes('/auth/v1/')) return route.fulfill({ json: SESSION });
    if (url.includes('/rest/v1/rpc/')) return route.fulfill({ json: null });
    if (url.includes('/rest/v1/')) return route.fulfill({ json: [] });
    return route.fulfill({ json: {} });
  });
  // Sounds and analytics are irrelevant to the smoke tests.
  await page.route('**assets.mixkit.co/**', (r) => r.abort());
  await page.route('https://*.posthog.com/**', (r) => r.abort());

  // Seed the fake auth session and a deterministic game store BEFORE any app
  // code runs. lastLoginDate=today and tutorialCompleted=true suppress the
  // first-run Daily Rewards / Tutorial modals so tests land on the main menu.
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
  // Main menu is the shared starting point for every test.
  await expect(page.getByRole('button', { name: 'Battle', exact: true })).toBeVisible(SLOW);
});

test('app boots to the main menu without page errors', async ({ page, pageErrors }) => {
  // Player profile (top-left card) shows the seeded player.
  const profile = page.getByRole('button', { name: 'View player stats' });
  await expect(profile).toBeVisible();
  await expect(profile).toContainText('QA Bear');

  // Battle menu tile is present (already awaited in beforeEach, re-assert).
  await expect(page.getByRole('button', { name: 'Battle', exact: true })).toBeVisible();

  expect(pageErrors, `Unexpected page errors: ${pageErrors.map((e) => e.message).join('; ')}`)
    .toHaveLength(0);
});

test('battle starts and a full turn plays out', async ({ page, pageErrors }) => {
  await page.getByRole('button', { name: 'Battle', exact: true }).click();

  // Board is up once the End Turn control appears (after the draw phase).
  const endTurn = page.getByRole('button', { name: 'End Turn' });
  await expect(endTurn).toBeVisible(SLOW);
  await expect(page.getByText(/Turn 1/)).toBeVisible(SLOW);

  // Play one full turn: end our turn, let the AI take its turn, and wait for
  // control to come back to the player on turn 2.
  await endTurn.click();
  await expect(page.getByText(/Turn 2/)).toBeVisible(SLOW);
  await expect(endTurn).toBeVisible(SLOW);

  expect(pageErrors, `Unexpected page errors: ${pageErrors.map((e) => e.message).join('; ')}`)
    .toHaveLength(0);
});

test('shop opens, shows gem bundles with prices, and closes on Escape', async ({ page }) => {
  await page.getByRole('button', { name: 'Shop', exact: true }).click();

  const dialog = page.getByRole('dialog', { name: 'Shop' });
  await expect(dialog).toBeVisible(SLOW); // lazy-loaded chunk

  await dialog.getByRole('button', { name: 'Buy Gems' }).click();

  // Five gem bundles, each an accessible button labelled with its $ price.
  const bundles = dialog.getByRole('button', { name: /^Buy \d+ gems for \$\d+\.\d{2}$/ });
  await expect(bundles).toHaveCount(5, SLOW);
  for (const bundle of await bundles.all()) {
    await expect(bundle).toContainText(/\$\d+\.\d{2}/);
  }

  // The dialog hook closes on Escape.
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0, SLOW);
});

test('deck builder renders the owned-card grid', async ({ page }) => {
  await page.getByRole('button', { name: 'Deck Builder', exact: true }).click();

  await expect(page.getByRole('heading', { name: 'Deck Builder' })).toBeVisible(SLOW);

  // Owned cards are clickable "Add <name> to deck" tiles; the default
  // collection owns 11 cards, so at least 5 must render.
  const ownedCards = page.getByRole('button', { name: /^Add .+ to deck$/ });
  await expect(ownedCards.first()).toBeVisible(SLOW);
  expect(await ownedCards.count()).toBeGreaterThanOrEqual(5);
});

test('an attacker that survives the opponent turn is usable again (exhaustion regression)', async ({ page, pageErrors }) => {
  // Force a deck of pure cheap action cards so the first play is always an
  // attack-capable creature (the default deck shuffles in traps/specials).
  await page.evaluate(() => {
    const stored = JSON.parse(localStorage.getItem('terrible-teddies-storage'));
    stored.state.currentDeck = [1, 2, 3, 4, 5, 6];
    localStorage.setItem('terrible-teddies-storage', JSON.stringify(stored));
  });
  await page.reload();
  await page.getByRole('button', { name: 'Battle', exact: true }).click(SLOW);

  const endTurn = page.getByRole('button', { name: 'End Turn' });
  await expect(endTurn).toBeVisible(SLOW);

  // Play a creature, enter battle phase, and attack the opponent's opener.
  await page.getByRole('button', { name: /^Play / }).first().click();
  const attacker = page.getByRole('button', { name: /^Select .+ to attack$/ }).first();
  await expect(attacker).toBeVisible(SLOW);
  await page.getByRole('button', { name: '⚔️ Battle' }).click();
  await attacker.click();
  const target = page.getByRole('button', { name: /^Attack / }).first();
  if (await target.count()) {
    await target.click();
  } else {
    await page.getByRole('button', { name: /Attack opponent directly|Strike/ }).click();
  }
  await expect(page.getByText('Exhausted').first()).toBeVisible(SLOW);

  // Survive the opponent's turn: the attacker must NOT still be Exhausted on
  // turn 2 (a stale write-back once bricked surviving attackers permanently).
  await endTurn.click();
  await expect(page.getByText(/Turn 2/)).toBeVisible(SLOW);
  await expect(endTurn).toBeVisible(SLOW);
  await expect(page.getByText('Exhausted')).toHaveCount(0);

  expect(pageErrors, `Unexpected page errors: ${pageErrors.map((e) => e.message).join('; ')}`)
    .toHaveLength(0);
});

test('concede shows the defeat dialog and Play Again deals a fresh game', async ({ page }) => {
  await page.getByRole('button', { name: 'Battle', exact: true }).click();
  await expect(page.getByRole('button', { name: 'End Turn' })).toBeVisible(SLOW);

  page.once('dialog', (d) => d.accept()); // window.confirm on concede
  await page.getByRole('button', { name: /Concede/ }).click();

  // Game-over screen is a real dialog with rewards and both exits.
  const defeat = page.getByRole('dialog', { name: 'Defeat' });
  await expect(defeat).toBeVisible(SLOW);
  await expect(defeat.getByText('Battle Rewards')).toBeVisible();
  await expect(defeat.getByRole('button', { name: 'Menu' })).toBeVisible();

  await defeat.getByRole('button', { name: 'Play Again' }).click();
  await expect(defeat).toHaveCount(0, SLOW);
  await expect(page.getByText(/Turn 1/)).toBeVisible(SLOW);
  await expect(page.getByRole('button', { name: 'End Turn' })).toBeVisible(SLOW);
});

test('Escape closes only the innermost layer of nested dialogs', async ({ page }) => {
  await page.getByRole('button', { name: 'Battle Pass', exact: true }).click();
  const pass = page.getByRole('dialog', { name: /battle pass/i });
  await expect(pass).toBeVisible(SLOW);

  // Open the nested premium purchase confirmation.
  await pass.getByRole('button', { name: /unlock premium/i }).click();
  await expect(page.getByText(/500/).first()).toBeVisible();

  // First Escape dismisses the confirm overlay but keeps the pass open…
  await page.keyboard.press('Escape');
  await expect(pass).toBeVisible();
  // …second Escape closes the pass itself.
  await page.keyboard.press('Escape');
  await expect(pass).toHaveCount(0, SLOW);
});

test('challenges dialog shows daily challenges and closes on Escape', async ({ page }) => {
  await page.getByRole('button', { name: 'Challenges', exact: true }).click();

  const dialog = page.getByRole('dialog', { name: 'Challenges' });
  await expect(dialog).toBeVisible(SLOW); // lazy-loaded chunk

  // Daily tab is active by default and lists the daily challenges.
  await expect(dialog.getByText('Win 3 Battles')).toBeVisible(SLOW);
  await expect(dialog.getByText('Play 5 Games')).toBeVisible();
  await expect(dialog.getByText('Deal 50 Damage')).toBeVisible();
  await expect(dialog.getByText('Use 10 Cards')).toBeVisible();

  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0, SLOW);
});
