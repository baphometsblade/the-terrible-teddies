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
  // The reset brings the tutorial back, so the list says so.
  await expect(deleted).toContainText('Tutorial completed — shown again');
  // The armed confirmation is a state no other spec audits.
  await expectNoAxeViolations(page, 'reset confirmation');

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
  await expectNoAxeViolations(page, 'claimed Starter offer');
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

// --- Spending gems ----------------------------------------------------------

// Hold Enter on the focused control: one press and `repeats` auto-repeats,
// sent as the browser's own key events (CDP), which is what makes Chrome
// click a focused button on every repeat. Playwright's keyboard.down never
// sets `repeat`.
async function holdEnter(page, repeats) {
  const cdp = await page.context().newCDPSession(page);
  const key = { key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13, nativeVirtualKeyCode: 13, text: '\r', unmodifiedText: '\r' };
  await cdp.send('Input.dispatchKeyEvent', { type: 'keyDown', ...key });
  for (let i = 0; i < repeats; i += 1) {
    await cdp.send('Input.dispatchKeyEvent', { type: 'keyDown', autoRepeat: true, ...key });
  }
  await cdp.send('Input.dispatchKeyEvent', { type: 'keyUp', ...key });
  await cdp.detach();
}

test('a held Enter on a gem tile asks once, spends nothing, and Buy spends the price once', async ({ page }) => {
  // A one-second hold on this tile used to buy sixteen Legendary packs.
  await seed(page, { gems: 1000, legendaryPacks: 0 });
  await page.getByRole('button', { name: 'Shop', exact: true }).click();
  const shop = page.getByRole('dialog', { name: 'Shop' });
  await expect(shop).toBeVisible(SLOW);
  const tile = shop.getByRole('button', { name: 'Buy Legendary Pack for 200 gems' });
  await tile.focus();
  await holdEnter(page, 15);

  const confirm = page.getByRole('dialog', { name: 'Buy Legendary Pack?' });
  await expect(confirm).toBeVisible(SLOW);
  await expect(confirm.getByRole('button', { name: 'Cancel' })).toBeFocused();
  await expect(confirm).toContainText('You have 1,000 gems · 800 after');
  expect((await saved(page)).gems).toBe(1000);
  await expectNoAxeViolations(page, 'gem spend confirm');

  // Held again on Buy itself: the first press buys, the repeats land on the
  // tile focus returns to, and buy nothing.
  await confirm.getByRole('button', { name: 'Buy for 200 gems' }).focus();
  await holdEnter(page, 15);
  await expect(confirm).toHaveCount(0);
  await expect(tile).toBeFocused();
  await expect.poll(async () => {
    const s = await saved(page);
    return [s.gems, s.legendaryPacks];
  }).toEqual([800, 1]);
  await expect(page.getByRole('dialog', { name: 'Buy Legendary Pack?' })).toHaveCount(0);

  // Escape backs out of the confirm and leaves the Shop open. (Past the
  // 400ms after a buy in which a press is taken for a double-click's second.)
  await page.waitForTimeout(500);
  await tile.click();
  await expect(confirm).toBeVisible(SLOW);
  await page.keyboard.press('Escape');
  await expect(confirm).toHaveCount(0);
  await expect(shop).toBeVisible();
  expect((await saved(page)).gems).toBe(800);
});

test('a double-click on a coin tile buys one pack', async ({ page }) => {
  await seed(page, { coins: 1000, cardPacks: 0 });
  await page.getByRole('button', { name: 'Shop', exact: true }).click();
  const shop = page.getByRole('dialog', { name: 'Shop' });
  await expect(shop).toBeVisible(SLOW);
  await shop.getByRole('button', { name: 'Buy Card Pack for 200 coins' }).dblclick();
  await expect.poll(async () => {
    const s = await saved(page);
    return [s.coins, s.cardPacks];
  }).toEqual([800, 1]);
  // Nothing else is still to come.
  await page.waitForTimeout(600);
  expect((await saved(page)).coins).toBe(800);
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
  // Check now went with the body it sat in; focus goes on to the next action
  // rather than falling to <body>.
  await expect(dialog.getByRole('button', { name: /Let.?s Play/ })).toBeFocused();
});

test('a stalled screen left open lands a late payment when the buyer comes back to the tab', async ({ page }) => {
  // A phone buyer who switched apps while the screen sat at "Still Waiting":
  // the screen had stopped checking and held the return-to-tab check off, so
  // the payment confirming meanwhile was never picked up.
  const stub = await stubPurchase(page, null);
  const dialog = await returnFromCheckout(page, 'cs_test_stalled_return');
  await runClockUntil(page, dialog.getByRole('heading', { name: 'Still Waiting for Stripe' }), 30_000);
  const gemsBefore = (await saved(page)).gems;

  stub.row = { ...ROW, status: 'completed' };
  stub.balance = 500;
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));

  await expect(dialog.getByText('Purchase Complete!')).toBeVisible(SLOW);
  await expect.poll(async () => (await saved(page)).gems).toBe(gemsBefore + 500);
  // Announced once, by the screen; not a second time by a toast.
  await page.clock.runFor(1_000);
  await expect(page.getByText('Payment confirmed')).toHaveCount(0);
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

// Two starter checkouts, both paid: the webhook refunds the second rather than
// credit the offer twice, and the buyer returning from it is told why.
test('a second Starter Gem Pack payment says it was refunded because the account has one', async ({ page }) => {
  await stubPurchase(page, { ...ROW, bundle_id: 'starter_bundle', gems_granted: 300, status: 'refunded_duplicate' });
  const dialog = await returnFromCheckout(page, 'cs_test_duplicate');
  await expect(dialog.getByRole('heading', { name: 'Payment Refunded' })).toBeVisible(SLOW);
  await expect(dialog).toContainText('one per account, and this account already has it');
  await expect(dialog).toContainText('refunded in full');
  await expect(dialog.getByRole('button', { name: 'Check now' })).toHaveCount(0);
  await expect(dialog.getByText('cs_test_duplicate')).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Return to Game' })).toBeFocused();
  await expectNoAxeViolations(page, 'refunded duplicate purchase');
});

// The screen's own refund phases only reach a buyer who stays on it. One who
// left early (a second Starter pack paid in another tab, refunded by the
// webhook) had the marker dropped in silence on the next return.
test('a payment refunded after the screen is closed is announced on the next return to the tab', async ({ page }) => {
  const stub = await stubPurchase(page, null);
  const dialog = await returnFromCheckout(page, 'cs_test_late_refund');
  await runClockUntil(page, dialog.getByRole('heading', { name: 'Waiting for Payment Confirmation' }));
  await dialog.getByRole('button', { name: 'Return to Game' }).click();
  await expect(dialog).toHaveCount(0, SLOW);
  const gemsBefore = (await saved(page)).gems;

  stub.row = { ...ROW, bundle_id: 'starter_bundle', gems_granted: 300, status: 'refunded_duplicate' };
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));

  await expect(page.getByText('Payment refunded').first()).toBeVisible(SLOW);
  await expect(page.getByText(/one per account, and this account already has it, so the payment was refunded in full/).first()).toBeVisible();
  expect((await saved(page)).gems).toBe(gemsBefore);
  // Settled: told once, and the next return reads nothing.
  const reads = stub.reads;
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await page.clock.runFor(1_000);
  expect(stub.reads).toBe(reads);
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
