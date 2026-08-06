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

// Measuring the DOCUMENT is not enough for dialogs: the panels have
// overflow-hidden / overflow-y-auto, so an over-wide row inside is silently
// CLIPPED — it never pushes the document, and a document-level check passes no
// matter how wide the content is (the exact reason the original six dialog
// tests could not fail). Measure INSIDE the dialog instead: no visible
// descendant may extend past the viewport's right edge.
async function expectDialogContentFits(page, dialogName) {
  const offenders = await page.evaluate((name) => {
    const dialog = [...document.querySelectorAll('[role="dialog"]')].find(
      (d) => (d.getAttribute('aria-label') || '').toLowerCase() === name.toLowerCase()
    );
    if (!dialog) return ['<dialog not found>'];
    const vw = window.innerWidth;
    const out = [];
    for (const el of dialog.querySelectorAll('*')) {
      const b = el.getBoundingClientRect();
      if (b.width === 0 || b.height === 0) continue;
      const st = getComputedStyle(el);
      if (st.visibility === 'hidden' || st.display === 'none' || st.opacity === '0') continue;
      if (b.right <= vw + 1) continue;
      // Reachable content is fine: if any ancestor up to the dialog root is a
      // horizontal scroller (overflow-x auto/scroll), the user can scroll to
      // this element — that is an intentional wide strip (e.g. the Battle Pass
      // tier rail), not a clipped-and-unreachable overflow. Only flag content
      // with no such escape: clipped by overflow-hidden, permanently off-screen.
      let reachable = false;
      for (let a = el.parentElement; a && a !== dialog.parentElement; a = a.parentElement) {
        const ox = getComputedStyle(a).overflowX;
        if (ox === 'auto' || ox === 'scroll') { reachable = true; break; }
      }
      if (reachable) continue;
      out.push(`${el.tagName.toLowerCase()}.${(el.className || '').toString().split(' ').slice(0, 3).join('.')} right=${Math.round(b.right)} (vw=${vw})`);
    }
    return [...new Set(out)].slice(0, 6);
  }, dialogName);
  expect(
    offenders,
    `content inside the "${dialogName}" dialog extends past the ${PHONE.width}px viewport ` +
      `(clipped, so a document-level check would miss it):\n  ${offenders.join('\n  ')}`
  ).toEqual([]);
}

const DIALOGS = [
  { trigger: 'Shop', dialog: 'Shop' },
  { trigger: 'Challenges', dialog: 'Challenges' },
  { trigger: 'Battle Pass', dialog: 'Battle Pass' },
  { trigger: 'Rankings', dialog: 'Leaderboard' },
  { trigger: 'Card Packs', dialog: 'Card packs' },
  { trigger: 'Settings', dialog: 'Settings' },
];

for (const { trigger, dialog } of DIALOGS) {
  test(`${dialog} dialog content fits the phone width`, async ({ page }) => {
    await page.getByRole('button', { name: trigger, exact: true }).click();
    await expect(page.getByRole('dialog', { name: dialog })).toBeVisible(SLOW);
    // The document must still not scroll sideways...
    await expectNoHorizontalOverflow(page, `${dialog} dialog`);
    // ...and nothing inside the (overflow-clipped) panel may spill past the edge.
    await expectDialogContentFits(page, dialog);
  });
}
