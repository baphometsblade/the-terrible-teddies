// Layout-integrity guard at phone width.
//
// The game is played one-handed as often as not, and a card grid plus several
// filter rows is exactly the shape that quietly overflows. This asserts the
// document never scrolls sideways on any screen at 390px — the narrowest
// mainstream phone width.
//
// The regression that motivated it: the collection's rarity filter was a
// non-wrapping `flex` row of six buttons totalling 494px. Its parent wrapped,
// but the row is a single flex item, so it pushed the whole document 52px
// sideways and every screen below it scrolled horizontally.
import { test, expect, bootToMainMenu, SLOW } from './helpers/session.js';

const PHONE = { width: 390, height: 844 };

test.use({ viewport: PHONE });

// Reports the overflow amount rather than a bare boolean, so a failure says
// how far off the layout is.
async function expectNoHorizontalOverflow(page, label) {
  const overflow = await page.evaluate(() => {
    const doc = document.documentElement;
    return doc.scrollWidth - doc.clientWidth;
  });
  expect(overflow, `"${label}" scrolls ${overflow}px sideways at ${PHONE.width}px wide`).toBeLessThanOrEqual(1);
}

test.beforeEach(async ({ page }) => {
  await bootToMainMenu(page);
});

test('main menu does not scroll sideways on a phone', async ({ page }) => {
  await expectNoHorizontalOverflow(page, 'main menu');
});

test('collection does not scroll sideways on a phone', async ({ page }) => {
  await page.getByRole('button', { name: 'Collection', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Card Collection' })).toBeVisible(SLOW);
  await expectNoHorizontalOverflow(page, 'collection');
});

test('deck builder does not scroll sideways on a phone', async ({ page }) => {
  await page.getByRole('button', { name: 'Deck Builder', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Deck Builder' })).toBeVisible(SLOW);
  await expectNoHorizontalOverflow(page, 'deck builder');
});

test('battle board does not scroll sideways on a phone', async ({ page }) => {
  await page.getByRole('button', { name: 'Battle', exact: true }).click();
  await expect(page.getByRole('button', { name: 'End Turn' })).toBeVisible(SLOW);
  await expectNoHorizontalOverflow(page, 'battle board');
});

// Dialogs render above the page, so an over-wide one shows up here too.
const DIALOGS = [
  { trigger: 'Shop', dialog: 'Shop' },
  { trigger: 'Challenges', dialog: 'Challenges' },
  { trigger: 'Battle Pass', dialog: 'Battle Pass' },
  { trigger: 'Rankings', dialog: 'Leaderboard' },
  { trigger: 'Card Packs', dialog: 'Card packs' },
  { trigger: 'Settings', dialog: 'Settings' },
];

for (const { trigger, dialog } of DIALOGS) {
  test(`${dialog} dialog does not scroll sideways on a phone`, async ({ page }) => {
    await page.getByRole('button', { name: trigger, exact: true }).click();
    await expect(page.getByRole('dialog', { name: dialog })).toBeVisible(SLOW);
    await expectNoHorizontalOverflow(page, `${dialog} dialog`);
  });
}
