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

// The menu header at the narrowest widths, with a paying player's balance.
// Its right-hand row (rewards, coins, gems, help, settings) could not wrap,
// and the root's overflow-x-hidden turned the overflow into clipping rather
// than scrolling — so the 390px document check above passed while Settings
// sat half off the screen at 320px and wholly off it at 360px with five-digit
// balances. And on a short phone (Safari's toolbars leave an iPhone SE about
// 553px) the hero fan pushed the Battle button below the fold.
for (const viewport of [
  { width: 320, height: 568 },
  { width: 360, height: 640 },
  { width: 375, height: 553 },
]) {
  test.describe(`main menu at ${viewport.width}x${viewport.height}`, () => {
    test.use({ viewport });

    test('every header control is on screen and Battle is above the fold', async ({ page }) => {
      await page.addInitScript(() => {
        const raw = localStorage.getItem('terrible-teddies-storage');
        const stored = raw ? JSON.parse(raw) : { state: {}, version: 3 };
        stored.state.coins = 12345;
        stored.state.gems = 1400;
        localStorage.setItem('terrible-teddies-storage', JSON.stringify(stored));
      });
      await page.reload();
      const battle = page.getByRole('button', { name: 'Battle', exact: true });
      await expect(battle).toBeVisible(SLOW);
      await expect(page.getByText('12,345')).toBeVisible();
      await page.waitForTimeout(800); // entrance animations

      for (const name of ['Daily rewards', 'How to play', 'Settings']) {
        const box = await page.getByRole('button', { name }).boundingBox();
        expect(box.x, `${name} starts off the left edge`).toBeGreaterThanOrEqual(0);
        expect(box.x + box.width, `${name} runs off the right edge`).toBeLessThanOrEqual(viewport.width);
      }
      const cta = await battle.boundingBox();
      expect(cta.y + cta.height, 'Battle is below the fold').toBeLessThanOrEqual(viewport.height);
    });
  });
}

// The battle board is a fixed-height column, so on a short phone the risk is
// vertical: the card rows used to be scaled by viewport-height breakpoints, and
// on real phone viewports — shorter than the device, once the browser's
// toolbars take their share — the player's row spilled out of the table onto
// the turn controls, painting over End Turn and taking its taps. These are the
// sizes a page actually gets on an iPhone SE, an iPhone 15 and a small Android
// with toolbars showing. Every row must stay inside the felt, and End Turn
// must be the thing under its own centre. 320x640 is the narrowest phone the
// board is drawn for, where the rows are scaled the most (and where the row's
// status slot used to hold them at 0.59).
for (const viewport of [
  { width: 375, height: 553 },
  { width: 393, height: 659 },
  { width: 360, height: 640 },
  { width: 320, height: 640 },
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
      // Exact: the cards' screen-reader descriptions say "Warming Up" too.
      await expect(page.getByText('Warming Up', { exact: true })).toHaveCount(2, SLOW); // a card on each side
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

      // Nothing on the table renders under 8px on screen. The rows are
      // scaled to fit (0.64 at 320x640, 0.45 here at 375x553), and the
      // names fell to 6.4px and 4.5px, the status chips with them: a card
      // below the threshold now drops its name (its control and its preview
      // name it), and the rest of its print grows to stay legible.
      const tiny = await page.evaluate(() => [...document.querySelectorAll('[data-field] *')]
        .filter((el) => [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim()))
        // Visible text only: an sr-only description is a 1px box.
        .filter((el) => { const r = el.getBoundingClientRect(); return r.width > 1 && r.height > 1; })
        .map((el) => {
          let zoom = 1;
          for (let a = el; a; a = a.parentElement) zoom *= parseFloat(getComputedStyle(a).zoom) || 1;
          return { text: el.textContent.trim(), px: parseFloat(getComputedStyle(el).fontSize) * zoom };
        })
        .filter((t) => t.px < 7.99)
        .map((t) => `${t.text} (${t.px.toFixed(1)}px)`));
      expect(tiny, 'text on the table renders under 8px').toEqual([]);
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

// Installed to an iPhone's home screen the game draws under the status bar
// and the home indicator: index.html asks for that (viewport-fit=cover, a
// black-translucent status bar), and env(safe-area-inset-*) is all that keeps
// the page out from under them. Only the battle board read it, so on the menu
// the profile chip sat under the clock, every dialog's title and Close under
// the clock and battery, and "← Menu" on top of the Collection's heading.
// Chromium reports an iPhone 15's insets through the DevTools protocol.
const INSETS = { top: 59, bottom: 34 };

test.describe('under an installed iPhone\'s status bar and home indicator', () => {
  test.beforeEach(async ({ page }) => {
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Emulation.setSafeAreaInsetsOverride', { insets: INSETS });
    await page.reload();
    await expect(page.getByRole('button', { name: 'Battle', exact: true })).toBeVisible(SLOW);
  });

  test('the menu header starts below the status bar', async ({ page }) => {
    await page.waitForTimeout(800); // the header's entrance
    const top = await page.locator('header').evaluate((h) => Math.min(...[...h.querySelectorAll('button, [role="button"]')]
      .map((el) => el.getBoundingClientRect().top)));
    expect(top, 'a header control is under the clock').toBeGreaterThanOrEqual(INSETS.top);
  });

  for (const trigger of ['Shop', 'Challenges', 'Battle Pass', 'Rankings', 'Card Packs', 'Settings', 'How to play', 'Daily rewards', 'View player stats']) {
    test(`the ${trigger} dialog keeps its title and Close below the status bar, and its foot above the home indicator`, async ({ page }) => {
      await page.getByRole('button', { name: trigger, exact: true }).click();
      const dialog = page.getByRole('dialog');
      await expect(dialog).toBeVisible(SLOW);
      await page.waitForTimeout(400); // the panel's entrance
      const top = await dialog.evaluate((d) => Math.min(...[...d.querySelectorAll('button, h1, h2')]
        .map((el) => el.getBoundingClientRect()).filter((r) => r.width > 0).map((r) => r.top)));
      expect(top, `${trigger}: a control or title is under the status bar`).toBeGreaterThanOrEqual(INSETS.top);
      // A short panel is centred clear of both whatever the scrim does, so
      // the scrim's own padding is checked too: the inset plus its 12px.
      const pad = await dialog.evaluate((d) => {
        const st = getComputedStyle(d.closest('.dialog-scrim') ?? d.querySelector('.dialog-scrim'));
        return { top: parseFloat(st.paddingTop), bottom: parseFloat(st.paddingBottom) };
      });
      expect(pad, `${trigger}: the scrim does not reserve the insets`)
        .toEqual({ top: INSETS.top + 12, bottom: INSETS.bottom + 12 });
      // Scrolled to its end, the panel stops short of the home indicator.
      const foot = await dialog.evaluate((d) => {
        d.scrollTop = d.scrollHeight;
        return d.querySelector('.dialog-panel').getBoundingClientRect().bottom;
      });
      expect(foot, `${trigger}: the panel's foot is under the home indicator`)
        .toBeLessThanOrEqual(PHONE.height - INSETS.bottom);
    });
  }

  for (const [tile, heading] of [['Collection', 'Card Collection'], ['Deck Builder', 'Deck Builder']]) {
    test(`on ${tile}, "← Menu" clears the status bar and the heading clears "← Menu"`, async ({ page }) => {
      await page.getByRole('button', { name: tile, exact: true }).click();
      const h1 = page.getByRole('heading', { name: heading, level: 1 });
      await expect(h1).toBeVisible(SLOW);
      await page.waitForTimeout(300); // the screen's fade
      const back = await page.getByRole('button', { name: '← Menu' }).boundingBox();
      const head = await h1.boundingBox();
      expect(back.y, '← Menu is under the clock').toBeGreaterThanOrEqual(INSETS.top);
      expect(head.y, '← Menu sits on the heading').toBeGreaterThanOrEqual(back.y + back.height);
    });
  }

  test('a toast lands below the status bar, on the menu and over a dialog', async ({ page }) => {
    test.skip(!!process.env.E2E_PREVIEW, 'imports the toast module from /src');
    const raise = (title) => page.evaluate(async (t) => {
      const { toast } = await import('/src/components/ui/use-toast.js');
      window.__probeToast = toast({ title: t, description: 'A notification.', duration: 60000 });
    }, title);
    const topOf = async (title) => {
      const li = page.locator('.toast-viewport > li').filter({ hasText: title });
      await expect(li).toBeVisible();
      await page.waitForTimeout(300); // its entrance
      return (await li.boundingBox()).y;
    };
    await raise('On the menu');
    expect(await topOf('On the menu'), 'a toast on the menu is under the clock').toBeGreaterThanOrEqual(INSETS.top);
    await page.evaluate(() => window.__probeToast.dismiss());
    await page.getByRole('button', { name: 'Shop', exact: true }).click();
    await expect(page.getByRole('dialog', { name: 'Shop' })).toBeVisible(SLOW);
    await raise('Over a dialog');
    expect(await topOf('Over a dialog'), 'a toast over a dialog is under the clock').toBeGreaterThanOrEqual(INSETS.top);
  });

  test('the battle board keeps "← Menu" below the status bar', async ({ page }) => {
    await page.getByRole('button', { name: 'Battle', exact: true }).click();
    await expect(page.getByRole('button', { name: 'End Turn' })).toBeVisible(SLOW);
    const back = await page.getByRole('button', { name: '← Menu' }).boundingBox();
    expect(back.y).toBeGreaterThanOrEqual(INSETS.top);
  });
});
