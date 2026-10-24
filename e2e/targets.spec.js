// Touch targets. The game holds every control to 44px, the smallest
// comfortable size for a finger: the menu, the board, BackButton and the
// account screens were taken there first, and the dialogs and card screens
// after them. Each control is measured by what a finger meets, not by its box:
// a run of points down and across its middle that land on it, so a hit area
// drawn larger than the control (the Settings switch's) counts, and one that
// a neighbour covers does not.
import { test, expect, bootToMainMenu, SLOW } from './helpers/session.js';

const MIN = 44;

// Writes over the seeded save and reloads with it (the boot's own seed is an
// init script too, registered first, so this one's fields win).
const seed = async (page, patch) => {
  await page.addInitScript((p) => {
    const raw = localStorage.getItem('terrible-teddies-storage');
    const stored = raw ? JSON.parse(raw) : { state: {}, version: 3 };
    Object.assign(stored.state, p);
    localStorage.setItem('terrible-teddies-storage', JSON.stringify(stored));
  }, patch);
  await page.reload();
  await expect(page.getByRole('button', { name: 'Battle', exact: true })).toBeVisible(SLOW);
};

// Every visible control under `root`, each brought on screen and measured
// along the lines through its middle. Returns those short of 44px either way.
const shortTargets = (root) => root.evaluate(async (scope, min) => {
  const named = (el) => (el.getAttribute('aria-label') || el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 40);
  const run = (el, horizontal) => {
    const r = el.getBoundingClientRect();
    const mid = horizontal ? r.top + r.height / 2 : r.left + r.width / 2;
    const [from, to] = horizontal ? [r.left - 30, r.right + 30] : [r.top - 30, r.bottom + 30];
    let first = null;
    let last = null;
    for (let p = Math.floor(from); p <= Math.ceil(to); p += 1) {
      const hit = horizontal ? document.elementFromPoint(p, mid) : document.elementFromPoint(mid, p);
      if (hit && (hit === el || el.contains(hit))) {
        if (first === null) first = p;
        last = p;
      }
    }
    return first === null ? 0 : last - first + 1;
  };
  const controls = [...scope.querySelectorAll('button, [role="switch"], [role="button"][tabindex="0"], a[href], input')]
    .filter((el) => el.getClientRects().length > 0 && !el.closest('.game-surface') && !el.closest('.toast-viewport'));
  const short = [];
  for (const el of controls) {
    el.scrollIntoView({ block: 'center', inline: 'center' });
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    const h = run(el, false);
    const w = run(el, true);
    if (h < min || w < min) short.push({ name: named(el), w, h, dot: el.hasAttribute('data-step-dot') });
  }
  return short;
}, MIN);

const MENU_DIALOGS = [
  ['Challenges', 'Challenges', 'Close challenges'],
  ['Battle Pass', 'Battle Pass', 'Close battle pass'],
  ['Shop', 'Shop', 'Close shop'],
  ['Card Packs', 'Card packs', 'Close card packs'],
  ['Rankings', 'Leaderboard', 'Close leaderboard'],
  ['Settings', 'Settings', 'Close settings'],
  ['How to play', 'How to play', 'Close tutorial'],
  [/^Daily rewards/, 'Daily Rewards', 'Close daily rewards'],
  ['View player stats', 'Player stats', 'Close stats'],
];

const open = async (page, trigger, name) => {
  await page.getByRole('button', { name: trigger, exact: typeof trigger === 'string' }).first().click();
  const dialog = page.getByRole('dialog', { name }).first();
  await expect(dialog).toBeVisible(SLOW);
  return dialog;
};

for (const viewport of [{ width: 390, height: 844 }, { width: 320, height: 640 }]) {
  test.describe(`at ${viewport.width}x${viewport.height}`, () => {
    test.use({ viewport });

    test.beforeEach(async ({ page }) => {
      await bootToMainMenu(page);
      // Something to claim on both Challenges tabs' cards, packs of every
      // tier, and a saved deck: the states that draw the controls measured.
      await seed(page, {
        todayWins: 10, todayBattles: 10, todayDamageDealt: 500, todayCardsPlayed: 50,
        dailyStatsDate: new Date().toDateString(), claimedChallenges: [],
        cardPacks: 2, premiumPacks: 1, legendaryPacks: 1,
        savedDecks: [{ name: 'Traps', cards: [30, 30, 40, 40, 41, 41, 42, 42, 1, 1] }],
      });
    });

    test('every control in the menu dialogs is a 44px target', async ({ page }) => {
      test.setTimeout(120_000);
      for (const [trigger, name, close] of MENU_DIALOGS) {
        const dialog = await open(page, trigger, name);
        // Settled: the panels rise in, and a box caught mid-rise is not
        // where a finger would meet it.
        await page.waitForTimeout(600);
        const box = await dialog.getByRole('button', { name: close }).boundingBox();
        expect([Math.round(box.width), Math.round(box.height)], `${name}'s Close`).toEqual([MIN, MIN]);
        const short = await shortTargets(dialog);
        // The tutorial's nine step buttons share the width of a phone, so
        // none can be 44px wide; they are 44px tall and leave no gap between
        // them instead, so the whole bar is target.
        const dots = short.filter((s) => s.dot);
        for (const d of dots) expect(d.h, d.name).toBeGreaterThanOrEqual(MIN);
        expect(short.filter((s) => !s.dot), `short targets in ${name}`).toEqual([]);
        if (dots.length) {
          const edges = await dialog.locator('[data-step-dot]').evaluateAll((els) => els.map((el) => {
            const r = el.getBoundingClientRect();
            return [r.left, r.right];
          }));
          for (let i = 1; i < edges.length; i += 1) expect(edges[i][0], 'a gap between step buttons').toBeCloseTo(edges[i - 1][1], 0);
        }
        if (name === 'Player stats') {
          // The rename field and its Save, drawn only while renaming.
          await dialog.getByRole('button', { name: 'Edit player name' }).click();
          expect(await shortTargets(dialog), 'short targets while renaming').toEqual([]);
          await page.keyboard.press('Escape');
        }
        await page.keyboard.press('Escape');
        await expect(dialog).toHaveCount(0);
      }
    });

    test('every control on the card screens and their dialogs is a 44px target', async ({ page }) => {
      test.setTimeout(90_000);
      await page.getByRole('button', { name: 'Collection', exact: true }).click();
      await expect(page.getByRole('heading', { name: 'Card Collection' })).toBeVisible(SLOW);
      await page.waitForTimeout(600);
      expect(await shortTargets(page.locator('[data-collection-filters]')), 'short targets in the filters').toEqual([]);
      await page.getByRole('button', { name: /^View / }).first().click();
      const detail = page.getByRole('dialog', { name: /details$/ });
      await expect(detail).toBeVisible(SLOW);
      await page.waitForTimeout(400);
      expect(await shortTargets(detail), 'short targets in the card detail').toEqual([]);
      await page.keyboard.press('Escape');
      await page.getByRole('button', { name: '← Menu' }).click();

      await page.getByRole('button', { name: 'Deck Builder', exact: true }).click();
      await expect(page.getByRole('heading', { name: 'Deck Builder' })).toBeVisible(SLOW);
      await page.waitForTimeout(600);
      // Everything but the pool's cards (whole cards, far larger).
      expect(await shortTargets(page.locator('#root')), 'short targets in the Deck Builder').toEqual([]);
      await page.getByRole('button', { name: /^Save As/ }).click();
      const save = page.getByRole('dialog', { name: 'Save deck' });
      await expect(save).toBeVisible(SLOW);
      await page.waitForTimeout(400);
      expect(await shortTargets(save), 'short targets in Save deck').toEqual([]);
    });
  });
}

// The Settings switch is drawn 24px tall; its row is its label, so the row's
// words are a target too, and the switch takes its name from them.
test('a Settings row toggles its switch from anywhere on it', async ({ page }) => {
  await bootToMainMenu(page);
  const dialog = await open(page, 'Settings', 'Settings');
  const sound = dialog.getByRole('switch', { name: 'Sound Effects' });
  await expect(sound).toHaveAccessibleDescription('Card plays, attacks, and abilities');
  const before = await sound.getAttribute('aria-checked');
  await dialog.getByText('Card plays, attacks, and abilities').click();
  await expect(sound).not.toHaveAttribute('aria-checked', before);
  // The switch itself still toggles once per tap: the label does not pass a
  // tap on its own control on a second time.
  await sound.click();
  await expect(sound).toHaveAttribute('aria-checked', before);
  const animations = dialog.getByRole('switch', { name: 'Animations' });
  const was = await animations.getAttribute('aria-checked');
  await dialog.getByText('Animations', { exact: true }).click();
  await expect(animations).not.toHaveAttribute('aria-checked', was);
});

// A toast over a dialog stops 4.75rem short of the right edge on a phone, so
// it never lands on the Close, now 44px. Pack odds sits furthest in.
test.describe('a toast over a dialog on a phone', () => {
  test.skip(!!process.env.E2E_PREVIEW, 'imports the toast module from /src');
  test.use({ viewport: { width: 320, height: 640 } });

  test('keeps clear of every Close', async ({ page }) => {
    test.setTimeout(90_000);
    await bootToMainMenu(page);
    const raise = () => page.evaluate(async () => {
      const { toast } = await import('/src/components/ui/use-toast.js');
      toast({ title: 'Achievement Unlocked!', description: 'Complete Collection — +10,000', duration: 60000 });
    });
    const gap = async (dialog) => {
      const t = await page.locator('.toast-viewport > li').first().boundingBox();
      const c = await dialog.getByRole('button', { name: /^Close/ }).first().boundingBox();
      return c.x - (t.x + t.width);
    };
    for (const [trigger, name] of MENU_DIALOGS) {
      const dialog = await open(page, trigger, name);
      await raise();
      await expect(page.locator('.toast-viewport > li')).toHaveCount(1);
      expect(await gap(dialog), `the toast reaches ${name}'s Close`).toBeGreaterThan(0);
      if (name === 'Shop') {
        await dialog.getByRole('button', { name: 'View odds' }).click();
        const odds = page.getByRole('dialog', { name: 'Pack odds' });
        await expect(odds).toBeVisible(SLOW);
        expect(await gap(odds), 'the toast reaches Pack odds\' Close').toBeGreaterThan(0);
        await page.keyboard.press('Escape');
      }
      await page.evaluate(async () => {
        const { resetToasts } = await import('/src/components/ui/use-toast.js');
        resetToasts();
      });
      await expect(page.locator('.toast-viewport > li[data-state="open"]')).toHaveCount(0);
      await page.keyboard.press('Escape');
      await expect(dialog).toHaveCount(0);
    }
  });
});
