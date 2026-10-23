// The paths where real money meets the save: what Reset All Progress keeps,
// the one-per-account Starter offer, and the purchase-return screen while a
// payment is still unconfirmed, refunded, or confirms late.
import AxeBuilder from '@axe-core/playwright';
import { test, expect, bootToMainMenu, SLOW } from './helpers/session.js';
import { getCurrentSeason } from '../src/utils/season.js';

const season = getCurrentSeason();
const STORAGE_KEY = 'terrible-teddies-storage';

test.beforeEach(async ({ page }) => {
  await bootToMainMenu(page);
});

// Patch the seeded save and reload into it (the boot's own seed runs first).
async function seed(page, patch) {
  await page.addInitScript(([key, p]) => {
    const raw = localStorage.getItem(key);
    const stored = raw ? JSON.parse(raw) : { state: {}, version: 3 };
    Object.assign(stored.state, p);
    localStorage.setItem(key, JSON.stringify(stored));
  }, [STORAGE_KEY, patch]);
  await page.reload();
  await expect(page.getByRole('button', { name: 'Battle', exact: true })).toBeVisible(SLOW);
}

const saved = (page) => page.evaluate((key) => JSON.parse(localStorage.getItem(key)).state, STORAGE_KEY);

test('Reset All Progress says what it keeps, in numbers, and keeps it', async ({ page }) => {
  // A buyer: 3,000 gems bought (the mark says so), this season's Premium Pass
  // and two unopened Premium packs, on top of ordinary progress.
  await seed(page, {
    gems: 3000, lastSyncedServerGems: 3000, seasonKey: season.key, hasBattlePassPremium: true,
    premiumPacks: 2, coins: 2345, level: 7,
  });

  await page.getByRole('button', { name: 'Settings' }).click();
  const dialog = page.getByRole('dialog', { name: 'Settings' });
  await expect(dialog).toBeVisible(SLOW);
  await dialog.getByRole('button', { name: 'Reset All Progress' }).click();

  const kept = dialog.getByRole('region', { name: 'Kept' });
  await expect(kept.getByText('3,000 gems', { exact: true })).toBeVisible();
  await expect(kept.getByText(`Premium Pass for ${season.name}`)).toBeVisible();
  await expect(kept.getByText('2 Premium packs, unopened')).toBeVisible();
  const deleted = dialog.getByRole('region', { name: 'Deleted' });
  await expect(deleted).toContainText('Level 7');
  await expect(deleted).toContainText('2,345 coins');

  await dialog.getByRole('textbox', { name: 'Type RESET to confirm the reset' }).fill('RESET');
  await dialog.getByRole('button', { name: 'Confirm Reset' }).click();
  await expect(dialog).toHaveCount(0, SLOW);

  await expect.poll(async () => {
    const s = await saved(page);
    return [s.gems, s.hasBattlePassPremium, s.premiumPacks, s.coins, s.level, s.lastSyncedServerGems];
  }).toEqual([3000, true, 2, 500, 1, 3000]);
});

async function openSpecialOffers(page) {
  await page.getByRole('button', { name: 'Shop', exact: true }).click();
  const shop = page.getByRole('dialog', { name: 'Shop' });
  await expect(shop).toBeVisible(SLOW);
  await shop.getByRole('button', { name: 'Special Offers' }).click();
  await expect(shop.getByText('Starter Gem Pack')).toBeVisible(SLOW);
  return shop;
}

test('an account that has its Starter Gem Pack sees it as claimed, with nothing to tap', async ({ page }) => {
  // The account's own purchases, as purchases_select_own returns them.
  let read = null;
  await page.route(/\/rest\/v1\/purchases/, (route) => {
    read = route.request().url();
    return route.fulfill({ json: [{ bundle_id: 'starter_bundle', status: 'completed' }] });
  });
  const shop = await openSpecialOffers(page);
  await expect(shop.getByText('Claimed', { exact: true })).toBeVisible(SLOW);
  await expect(shop.getByText("One per account, and you've had yours.")).toBeVisible();
  await expect(shop.getByRole('button', { name: 'Buy Now' })).toHaveCount(0);
  // Scoped to this player and to the one-per-account bundle.
  expect(decodeURIComponent(read)).toContain('user_id=eq.11111111-1111-4111-8111-111111111111');
  expect(decodeURIComponent(read)).toContain('bundle_id=in.(');
});

test('a refunded Starter Gem Pack is on sale again', async ({ page }) => {
  await page.route(/\/rest\/v1\/purchases/, (route) =>
    route.fulfill({ json: [{ bundle_id: 'starter_bundle', status: 'refunded' }] }));
  const shop = await openSpecialOffers(page);
  await expect(shop.getByText('One per account.', { exact: true })).toBeVisible(SLOW);
  await expect(shop.getByRole('button', { name: 'Buy Now' })).toBeVisible();
});

test("the checkout's one-per-account refusal marks the offer claimed instead of reading as a failure", async ({ page }) => {
  // The purchases read says nothing (bought on another device a moment ago,
  // say); the checkout function knows better and answers 409.
  await page.route('**/functions/v1/create-checkout-session', (route) => route.fulfill({
    status: 409,
    json: { error: "You've already bought the Starter Gem Pack. It's one per account.", code: 'already_purchased' },
  }));
  const shop = await openSpecialOffers(page);
  await shop.getByRole('button', { name: 'Buy Now' }).click();

  await expect(page.getByText('Already claimed').first()).toBeVisible(SLOW);
  await expect(page.getByText('Checkout Failed')).toHaveCount(0);
  const claimed = shop.getByText('Claimed', { exact: true });
  await expect(claimed).toBeVisible();
  await expect(claimed).toBeFocused();
  await expect(shop.getByRole('button', { name: 'Buy Now' })).toHaveCount(0);
});

// --- Coming back from Stripe before the payment is confirmed ---------------

const ROW = { gems_granted: 500, bundle_id: 'gems_large' };

// The purchases row as the verification read sees it, switchable mid-test.
// Counts the reads, so a test can tell the checks stopped. maybeSingle()
// unwraps a one-element array; an empty one is "no row yet".
async function stubPurchase(page, initial) {
  const state = { row: initial, reads: 0, balance: null };
  await page.route(/\/rest\/v1\/purchases/, (route) => {
    state.reads += 1;
    return route.fulfill({ json: state.row ? [state.row] : [] });
  });
  await page.route(/\/rest\/v1\/user_gems/, (route) =>
    route.fulfill({ json: state.balance === null ? [] : [{ gems: state.balance }] }));
  return state;
}

// Run the page's own clock forward until `locator` shows, a step at a time,
// so each check's request can answer before the next timer is due.
async function runClockUntil(page, locator, step = 2_000) {
  await expect(async () => {
    await page.clock.runFor(step);
    await expect(locator).toBeVisible({ timeout: 100 });
  }).toPass({ timeout: 60_000, intervals: [0] });
}

async function returnFromCheckout(page, sessionId) {
  await page.goto(`/?purchase=success&session_id=${sessionId}`);
  const dialog = page.getByRole('dialog', { name: 'Purchase status' });
  await expect(dialog).toBeVisible(SLOW);
  // Installed now, so the boot ran on real time; every check from here on
  // is on the page's fake clock.
  await page.clock.install();
  return dialog;
}

async function expectNoAxeViolations(page, label) {
  const { violations } = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  expect(violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.html).join(' | ')}`), label).toEqual([]);
}

test('an unconfirmed payment: honest copy, the reference to keep, ten minutes of checks, then it says so', async ({ page }) => {
  const stub = await stubPurchase(page, null);
  const dialog = await returnFromCheckout(page, 'cs_test_unconfirmed');

  const waiting = dialog.getByRole('heading', { name: 'Waiting for Payment Confirmation' });
  await runClockUntil(page, waiting);
  // Never "received" before Stripe says so, and no contact that leads nowhere.
  await expect(dialog).not.toContainText(/received|within a minute|contact support/i);
  await expect(dialog.getByText('cs_test_unconfirmed')).toBeVisible();
  await expect(dialog.getByText(/Keep this reference/)).toBeVisible();
  // This build has no VITE_SUPPORT_EMAIL: so no email link either.
  await expect(dialog.locator('a[href^="mailto:"]')).toHaveCount(0);
  await expectNoAxeViolations(page, 'pending purchase');

  const stalled = dialog.getByRole('heading', { name: 'Still Waiting for Stripe' });
  await runClockUntil(page, stalled, 30_000);
  await expect(dialog).toContainText('Nothing is lost');
  await expectNoAxeViolations(page, 'stalled purchase');

  // Then it really has stopped: ten more minutes, not one more read.
  const reads = stub.reads;
  expect(reads).toBeLessThanOrEqual(12 + 27);
  for (let i = 0; i < 20; i++) await page.clock.runFor(30_000);
  expect(stub.reads).toBe(reads);

  // Check now still works, and lands the gems once Stripe has confirmed.
  stub.row = { ...ROW, status: 'completed' };
  stub.balance = 500;
  await dialog.getByRole('button', { name: 'Check now' }).click();
  await expect(dialog.getByText('Purchase Complete!')).toBeVisible(SLOW);
});

test('a refunded payment says no gems were added, and does not wait for any', async ({ page }) => {
  await stubPurchase(page, { ...ROW, status: 'refunded' });
  const dialog = await returnFromCheckout(page, 'cs_test_refunded');
  await expect(dialog.getByRole('heading', { name: 'Payment Refunded' })).toBeVisible(SLOW);
  await expect(dialog).toContainText("its gems aren't on your account");
  await expect(dialog.getByRole('button', { name: 'Check now' })).toHaveCount(0);
  await expect(dialog.getByText('cs_test_refunded')).toBeVisible();
  await expectNoAxeViolations(page, 'refunded purchase');
});

test('gems from a payment that confirms after the screen is closed land on the next return to the tab', async ({ page }) => {
  const stub = await stubPurchase(page, null);
  const dialog = await returnFromCheckout(page, 'cs_test_late');
  await runClockUntil(page, dialog.getByRole('heading', { name: 'Waiting for Payment Confirmation' }));
  await dialog.getByRole('button', { name: 'Return to Game' }).click();
  await expect(dialog).toHaveCount(0, SLOW);
  const gemsBefore = (await saved(page)).gems;

  // The webhook lands while the player is in the menu.
  stub.row = { ...ROW, status: 'completed' };
  stub.balance = 500;
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));

  await expect(page.getByText('Payment confirmed').first()).toBeVisible(SLOW);
  await expect.poll(async () => (await saved(page)).gems).toBe(gemsBefore + 500);

  // Settled: the next return reads nothing.
  const reads = stub.reads;
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await page.clock.runFor(1_000);
  expect(stub.reads).toBe(reads);
});
