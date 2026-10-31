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
import { test, expect, bootToMainMenu, stubSupabase, SLOW } from './helpers/session.js';
// Pure, as door.js is: the rows the menu's clock is drawn from, so a line
// dropped into any of them is measured here, not just the shipped ones.
import { BAR_CLOCK } from '../src/lib/barClock.js';
import { getCurrentSeason } from '../src/utils/season.js';

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

test.beforeEach(async ({ page, doorPassed }) => {
  // The door's own checks (at the end of this file) are of a device that has
  // not passed it yet, and boot themselves.
  if (doorPassed) await bootToMainMenu(page);
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

// The menu's bar-clock sign (src/lib/barClock.js) and the Battle button's line.
// Below lg there is no sign: it is hung in the hero's corner from lg up, so it
// can take no room that Battle's place above the fold depends on, and the clock
// is the button's line instead, which has to fit its column for EVERY row of
// the clock table (a character count cannot say: the column is pixels, and
// wide capitals fill it sooner) without wrapping or pushing Battle down.
const atHour = (hour) => new Date(2026, 9, 31, hour, 30);
for (const viewport of [
  { width: 320, height: 568 },
  { width: 359, height: 640 }, // the last width at the smaller 13px line
  { width: 360, height: 640 },
  { width: 375, height: 553 },
]) {
  test.describe(`the bar clock at ${viewport.width}x${viewport.height}`, () => {
    test.use({ viewport });

    for (const row of BAR_CLOCK) {
      const hour = row.from;
      test(`draws no sign, and Battle's line fits its column above the fold at ${row.id} ("${row.subtitle}")`, async ({ page }) => {
        await page.clock.setFixedTime(atHour(hour));
        await page.reload();
        const battle = page.getByRole('button', { name: 'Battle', exact: true });
        await expect(battle).toBeVisible(SLOW);
        await page.waitForTimeout(800); // entrance animations
        // The sign is not drawn below lg (not just out of sight: display none).
        await expect(page.locator('.neon')).toBeHidden();
        expect(await page.locator('.neon').evaluate((el) => getComputedStyle(el.closest('[aria-hidden="true"]')).display)).toBe('none');
        // The line is one line, inside its column and inside the button.
        const line = await page.locator('#menu-battle-line').evaluate((el) => {
          const button = el.closest('[role="button"]').getBoundingClientRect();
          const r = el.getBoundingClientRect();
          return { text: el.textContent, lines: Math.round(r.height / parseFloat(getComputedStyle(el).lineHeight)), clipped: el.scrollWidth - el.clientWidth, inside: r.right <= button.right && r.left >= button.left };
        });
        expect(line.text).toBe(row.subtitle);
        expect(line.lines, `"${line.text}" wraps`).toBe(1);
        expect(line.clipped, `"${line.text}" is clipped`).toBeLessThanOrEqual(0);
        expect(line.inside, `"${line.text}" runs out of the button`).toBe(true);
        const cta = await battle.boundingBox();
        expect(cta.y + cta.height, 'Battle is below the fold').toBeLessThanOrEqual(viewport.height);
      });
    }
  });
}

// From lg the sign is hung in the hero's corner. It must sit clear of the
// header, the title, the card fan and the Battle button at every width the
// hero lays out at, and never push the page sideways, for every row of the
// clock table (the plain sign, the flickering one, the one with a note taped
// under it, and whatever wave B writes into them). From 768 to 1023 the 72px
// title spans most of the width, and a sign there read as a label on the
// settings gear, so below lg it is not drawn and the Battle line is the clock.
for (const viewport of [
  { width: 768, height: 1024 },
  { width: 768, height: 701 },
  { width: 768, height: 600 },
  { width: 900, height: 700 },
  { width: 1023, height: 700 },
  { width: 1023, height: 800 },
  { width: 1024, height: 768 },
  { width: 1024, height: 600 },
  { width: 1280, height: 800 },
  { width: 1440, height: 900 },
]) {
  const drawn = viewport.width >= 1024;
  test.describe(`the bar clock's sign at ${viewport.width}x${viewport.height}`, () => {
    test.use({ viewport });

    test(`is ${drawn ? 'drawn' : 'not drawn'}`, async ({ page }) => {
      await page.clock.setFixedTime(atHour(3));
      await page.reload();
      await expect(page.getByRole('button', { name: 'Battle', exact: true })).toBeVisible(SLOW);
      await page.waitForTimeout(300);
      if (drawn) await expect(page.locator('.neon')).toBeVisible();
      else await expect(page.locator('.neon')).toBeHidden();
      if (drawn) await expect(page.locator('.note-taped')).toBeVisible();
      else await expect(page.locator('.note-taped')).toBeHidden();
      // Whatever is drawn, the clock is also the Battle line.
      await expect(page.locator('#menu-battle-line')).toHaveText(BAR_CLOCK.find((r) => r.id === 'closed').subtitle);
      await expectNoHorizontalOverflow(page, 'the menu');
    });

    for (const row of drawn ? BAR_CLOCK : []) {
      const part = row.id;
      const hour = row.from;
      test(`hangs clear of the header, the title and Battle at ${part} ("${row.sign}")`, async ({ page }) => {
        await page.clock.setFixedTime(atHour(hour));
        await page.reload();
        await expect(page.getByRole('button', { name: 'Battle', exact: true })).toBeVisible(SLOW);
        await page.waitForTimeout(1200); // entrances, and the sign's switching on
        await expect(page.locator('.neon')).toBeVisible();
        await expectNoHorizontalOverflow(page, `the menu with the ${part} sign`);
        const boxes = await page.evaluate(() => {
          const rect = (el) => { const r = el.getBoundingClientRect(); return { left: r.left, top: r.top, right: r.right, bottom: r.bottom }; };
          // The whole sign: the tube and its note, as the viewer sees them (the
          // sign is turned a few degrees, which the bounding box covers).
          const sign = rect(document.querySelector('.neon').closest('[aria-hidden="true"]'));
          return {
            sign,
            others: {
              header: rect(document.querySelector('header')),
              title: rect(document.querySelector('h1')),
              tagline: rect(document.querySelector('h1').nextElementSibling),
              // The card fan and the Battle button, side by side.
              'fan and Battle': rect(document.querySelector('[data-dest="game"]').closest('[class*="md:flex-row"]')),
            },
            vw: window.innerWidth,
          };
        });
        const hits = (a, b) => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
        expect(boxes.sign.right, 'the sign runs off the right edge').toBeLessThanOrEqual(boxes.vw);
        expect(boxes.sign.left, 'the sign runs off the left edge').toBeGreaterThanOrEqual(0);
        for (const [name, box] of Object.entries(boxes.others)) {
          expect(hits(boxes.sign, box), `the sign overlaps the ${name}`).toBe(false);
        }
      });
    }
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

// The door, for a device that has not passed it (the tests above start past
// it). Its own widths and the smallest phones are e2e/door.spec.js's; here it
// is held to the same two rules as every other screen: it never scrolls
// sideways at 390px, and under an installed iPhone's status bar and home
// indicator it keeps its content clear of both.
test.describe('the door', () => {
  test.use({ doorPassed: false });
  const YEAR = new Date().getFullYear();

  const atTheDoor = async (page) => {
    await stubSupabase(page);
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'ID.', level: 1 })).toBeVisible(SLOW);
    await expect(page.locator('form[data-armed="true"]')).toBeVisible();
  };

  test('does not scroll sideways on a phone: the form, the question and the turning away', async ({ page }) => {
    await atTheDoor(page);
    await expectNoHorizontalOverflow(page, 'the door');
    await page.getByLabel('Year you were born').fill(String(YEAR - 18));
    await page.getByRole('button', { name: 'Come in' }).click();
    await expect(page.getByRole('heading', { name: 'Had your birthday yet this year?' })).toBeVisible();
    await expectNoHorizontalOverflow(page, 'the birthday question');
    await page.locator('[data-armed="true"]').filter({ has: page.getByRole('button', { name: 'Not yet', exact: true }) }).waitFor();
    await page.getByRole('button', { name: 'Not yet', exact: true }).click();
    await expect(page.getByRole('status')).toBeVisible();
    await expectNoHorizontalOverflow(page, 'the turning away');
  });

  // On a screen as short as the door is tall, so the content reaches both
  // edges and only the padding keeps it off the clock and the home indicator
  // (on a tall phone it would be centred clear of both whatever it did).
  test("keeps its sign and its controls clear of an installed iPhone's status bar and home indicator", async ({ page }) => {
    const height = 600;
    await page.setViewportSize({ width: PHONE.width, height });
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Emulation.setSafeAreaInsetsOverride', { insets: INSETS });
    await atTheDoor(page);
    await page.waitForTimeout(900); // the sign's switching on
    const extent = () => page.evaluate(() => {
      const boxes = [...document.querySelectorAll('[data-door-stage] .neon, [data-door-stage] h1, [data-door-stage] button, [data-door-stage] input')]
        .filter((el) => el.getClientRects().length > 0 && getComputedStyle(el).visibility !== 'hidden')
        .map((el) => el.getBoundingClientRect());
      return { top: Math.min(...boxes.map((b) => b.top)), bottom: Math.max(...boxes.map((b) => b.bottom)) };
    });
    // At the top of the page, the sign is below the clock...
    expect((await extent()).top, 'the sign is under the clock').toBeGreaterThanOrEqual(INSETS.top);
    // ...and scrolled to its end, the controls stop short of the home indicator.
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    expect((await extent()).bottom, 'a control is under the home indicator').toBeLessThanOrEqual(height - INSETS.bottom);
  });
});

// The result panel, and the Tab it prints, on the phones that are shortest: an
// iPhone SE with Safari's toolbars out (320x568), a short 375 (553), and a
// phone on its side. The receipt makes the panel taller than the two chips it
// replaced, so on these it scrolls, and what matters is that nothing runs
// sideways, nothing on the paper wraps or spills, and Play Again is still on
// screen once the panel has settled (useDialog focused it while the panel was
// still arriving at 85% of its size, so the scroll it did was for a shorter
// panel). The four itemized rows are dropped from sight below 700px tall.
for (const viewport of [
  { width: 320, height: 568 },
  { width: 375, height: 553 },
  { width: 667, height: 375 },
  { width: 390, height: 844 },
]) {
  for (const { name, state } of [
    { name: 'a plain result', state: {} },
    {
      // The most it carries: a level-up, a Battle Pass tier and the shop nudge.
      name: 'a level-up, a Battle Pass tier and the shop nudge',
      state: { level: 1, xp: 95, seasonXP: 90, seasonKey: getCurrentSeason().key, gems: 0, cardPacks: 0 },
    },
  ]) {
    test.describe(`the result panel at ${viewport.width}x${viewport.height}`, () => {
      test.use({ viewport });

      test(`${name}: nothing runs sideways or off the paper, and Play Again is on screen`, async ({ page }) => {
        await page.addInitScript((extra) => {
          const raw = localStorage.getItem('terrible-teddies-storage');
          const stored = raw ? JSON.parse(raw) : { state: {}, version: 3 };
          Object.assign(stored.state, extra);
          localStorage.setItem('terrible-teddies-storage', JSON.stringify(stored));
        }, state);
        await page.reload();
        await page.getByRole('button', { name: 'Battle', exact: true }).click();
        await expect(page.getByRole('button', { name: 'End Turn' })).toBeVisible(SLOW);
        await page.getByRole('button', { name: 'Concede', exact: true }).click();
        await page.getByRole('button', { name: 'Concede — counts as a loss' }).click();
        const panel = page.getByRole('dialog', { name: 'Defeat' });
        await expect(panel).toBeVisible(SLOW);
        await expect(panel.getByRole('button', { name: 'Play Again' })).toBeFocused();
        await page.waitForTimeout(1200); // the panel arrives, then Play Again is scrolled back into view

        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        expect(overflow, 'the page scrolls sideways').toBeLessThanOrEqual(1);

        const play = await panel.getByRole('button', { name: 'Play Again' }).boundingBox();
        expect(play.y, 'Play Again is above the top of the screen').toBeGreaterThanOrEqual(0);
        expect(play.y + play.height, 'Play Again is below the fold').toBeLessThanOrEqual(viewport.height);
        expect(play.x + play.width, 'Play Again runs off the right edge').toBeLessThanOrEqual(viewport.width);

        const paper = await panel.locator('.receipt').evaluate((sheet) => {
          const box = sheet.getBoundingClientRect();
          const spill = [...sheet.querySelectorAll('*')]
            .map((el) => el.getBoundingClientRect())
            .filter((r) => r.width > 1 && r.height > 1)
            .map((r) => Math.max(0, box.left - r.left, r.right - box.right));
          const rows = [...sheet.querySelectorAll('dl > div')]
            .filter((row) => getComputedStyle(row).position !== 'absolute')
            .map((row) => ({ label: row.querySelector('dt').textContent, h: Math.round(row.getBoundingClientRect().height) }));
          return { left: box.left, right: box.right, spill: Math.max(0, ...spill), rows };
        });
        expect(paper.left, 'the receipt starts off the left edge').toBeGreaterThanOrEqual(0);
        expect(paper.right, 'the receipt runs off the right edge').toBeLessThanOrEqual(viewport.width);
        expect(paper.spill, 'something on the receipt runs past the paper').toBeLessThanOrEqual(1);
        for (const row of paper.rows) expect(row.h, `${row.label} wraps`).toBeLessThanOrEqual(24);

        // The itemized rows are on the paper from 701px tall, and off it below.
        const cards = await panel.getByRole('term').filter({ hasText: /^Cards played$/ }).locator('..').boundingBox();
        if (viewport.height > 700) expect(cards.height, 'the rows are missing on a tall screen').toBeGreaterThan(10);
        else expect(cards.width * cards.height, 'the rows are on a short screen').toBeLessThanOrEqual(4);
      });
    });
  }
}
