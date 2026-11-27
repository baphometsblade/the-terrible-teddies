// The Naughty List door. The server says the season is upcoming, so the menu
// counts down to starts_at and the shop will name the ten. Nothing in the
// test, and nothing in the page, may treat that as open: the laptop clock is
// set past 1 Dec on purpose.
import AxeBuilder from '@axe-core/playwright';
import { test, expect, stubSupabase, seedSignedIn, SLOW } from './helpers/session.js';
import { NAUGHTY_LIST_SEASON } from '../src/data/naughtyList.js';
import { DOOR_BUTTON, DOOR_ODDS, DOOR_WAIT, peekLine } from '../src/lib/seasonDoorCopy.js';

const SERVER_NOW = '2026-11-27T00:00:00.000Z';
const UPCOMING = {
  server_now: SERVER_NOW,
  seasons: [{ ...NAUGHTY_LIST_SEASON, status: 'upcoming' }],
};

const settle = async (page) => {
  await page.waitForFunction(
    () => document.getAnimations().every((animation) => animation.playState !== 'running'),
    null,
    { timeout: 5_000 },
  ).catch(() => {});
  await page.waitForTimeout(400);
};

test.beforeEach(async ({ page }) => {
  await stubSupabase(page);
  // Registered after the catch-all stub, so this RPC wins and the rest of
  // the fake project still answers empty.
  await page.route('**/rest/v1/rpc/open_card_pack**', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify(UPCOMING),
  }));
  await seedSignedIn(page);
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Battle', exact: true })).toBeVisible(SLOW);
});

test('counts down from the server and does not say the packs are open', async ({ page }) => {
  const banner = page.getByRole('region', { name: 'The Naughty List' });
  await expect(banner).toBeVisible(SLOW);
  await expect(banner).toHaveAttribute('data-season-state', 'upcoming');
  await expect(banner.locator('[data-season-clock]')).toHaveText('Opens in 3d 14h');
  await expect(banner).toContainText(DOOR_WAIT);
  await expect(banner).toContainText(DOOR_ODDS);
  await expect(banner).not.toContainText('On the floor');
  await expect(page.getByRole('button', { name: DOOR_BUTTON })).toBeVisible();
});

test('fits the desk and the phone without covering Battle or running off the screen', async ({ page }) => {
  const banner = page.getByRole('region', { name: 'The Naughty List' });
  await expect(banner).toBeVisible(SLOW);

  for (const viewport of [
    { width: 1280, height: 800, shot: 'test-results/season-banner-desktop.png' },
    { width: 390, height: 844, shot: 'test-results/season-banner-phone.png' },
    { width: 320, height: 568, shot: 'test-results/season-banner-narrow.png' },
  ]) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.reload();
    await expect(banner).toBeVisible(SLOW);
    await expect(banner.locator('[data-season-clock]')).toHaveText('Opens in 3d 14h');
    await settle(page);
    const battle = page.getByRole('button', { name: 'Battle', exact: true });
    const cta = await battle.boundingBox();
    expect(cta.y + cta.height, `Battle is below the fold at ${viewport.width}`).toBeLessThanOrEqual(viewport.height);
    const box = await banner.boundingBox();
    expect(box.y, 'the banner covers Battle').toBeGreaterThanOrEqual(cta.y + cta.height - 1);
    expect(box.x, 'banner starts off the left edge').toBeGreaterThanOrEqual(0);
    expect(box.x + box.width, 'banner runs off the right edge').toBeLessThanOrEqual(viewport.width + 1);
    const button = await page.getByRole('button', { name: DOOR_BUTTON }).boundingBox();
    expect(button.height, 'the peek control is under 44px').toBeGreaterThanOrEqual(44);
    expect(button.width, 'the peek control is under 44px').toBeGreaterThanOrEqual(44);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, `sideways scroll at ${viewport.width}`).toBeLessThanOrEqual(1);
    await banner.scrollIntoViewIfNeeded();
    await page.screenshot({ path: viewport.shot.replace('.png', '-view.png') });
    await banner.screenshot({ path: viewport.shot });
  }
});

test('the peek names the ten and sells none of them', async ({ page }) => {
  await page.getByRole('button', { name: DOOR_BUTTON }).click();
  const shop = page.getByRole('dialog', { name: 'Shop' });
  await expect(shop).toBeVisible(SLOW);
  const panel = shop.locator('[data-season-state="upcoming"]');
  await expect(panel).toBeVisible();
  await expect(panel).toContainText(peekLine(10));
  await expect(panel).toContainText('Sleazy Santa');
  await expect(panel).toContainText('Under-Desk Uma');
  await expect(panel).not.toContainText('In every pack while the party is on');
  await expect(panel.getByRole('button')).toHaveCount(0);
  await settle(page);
  const open = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  expect(open.violations, JSON.stringify(open.violations, null, 2)).toEqual([]);
  await page.setViewportSize({ width: 320, height: 568 });
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow, 'the peek runs off a 320px screen').toBeLessThanOrEqual(1);
  await page.setViewportSize({ width: 390, height: 844 });
  await shop.screenshot({ path: 'test-results/season-peek-phone.png' });
  await page.setViewportSize({ width: 1280, height: 800 });
  await shop.screenshot({ path: 'test-results/season-peek-desktop.png' });
});

test('the menu with the door up has no WCAG 2.1 A/AA violations', async ({ page }) => {
  const banner = page.getByRole('region', { name: 'The Naughty List' });
  await expect(banner).toBeVisible(SLOW);
  await settle(page);
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  expect(results.violations, JSON.stringify(results.violations, null, 2)).toEqual([]);
});
