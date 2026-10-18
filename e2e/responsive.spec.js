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

// The battle board is a fixed-height column, so on a short phone the risk is
// vertical: the card rows used to be scaled by viewport-height breakpoints, and
// on real phone viewports — shorter than the device, once the browser's
// toolbars take their share — the player's row spilled out of the table onto
// the turn controls, painting over End Turn and taking its taps. These are the
// sizes a page actually gets on an iPhone SE, an iPhone 15 and a small Android
// with toolbars showing. Every row must stay inside the felt, and End Turn
// must be the thing under its own centre.
for (const viewport of [
  { width: 375, height: 553 },
  { width: 393, height: 659 },
  { width: 360, height: 640 },
]) {
  test.describe(`battle board at ${viewport.width}x${viewport.height}`, () => {
    test.use({ viewport });

    test('card rows stay on the table and the turn controls take their own taps', async ({ page }) => {
      // Cheap creatures, so the first play is affordable and lands on the field.
      await page.addInitScript(() => {
        const raw = localStorage.getItem('terrible-teddies-storage');
        const stored = raw ? JSON.parse(raw) : { state: {}, version: 3 };
        stored.state.currentDeck = [1, 2, 3, 4, 5, 6];
        localStorage.setItem('terrible-teddies-storage', JSON.stringify(stored));
      });
      await page.reload();
      await page.getByRole('button', { name: 'Battle', exact: true }).click();
      const endTurn = page.getByRole('button', { name: 'End Turn' });
      await expect(endTurn).toBeVisible(SLOW);
      await page.getByRole('button', { name: /^Play / }).first().click();
      await expect(page.getByText('Warming Up')).toHaveCount(2, SLOW); // a card on each side
      await page.waitForTimeout(600); // entrance animations

      const spill = await page.evaluate(() => {
        const felt = document.querySelector('.felt-table').getBoundingClientRect();
        return [...document.querySelector('.felt-table').children]
          .filter((el) => getComputedStyle(el).position === 'static')
          .map((el) => el.getBoundingClientRect())
          .map((r) => Math.max(0, felt.top - r.top, r.bottom - felt.bottom))
          .map(Math.round);
      });
      expect(Math.max(...spill), `rows spill past the felt by ${spill.join('/')}px`).toBeLessThanOrEqual(1);

      const box = await endTurn.boundingBox();
      const hit = await page.evaluate(({ x, y }) => {
        const el = document.elementFromPoint(x, y);
        return el?.closest('button')?.textContent?.trim() ?? el?.tagName;
      }, { x: box.x + box.width / 2, y: box.y + box.height / 2 });
      expect(hit, 'whatever sits on End Turn takes its taps').toBe('End Turn');
    });
  });
}

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
