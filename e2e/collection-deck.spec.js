// The two card screens — the Collection and the Deck Builder — at the sizes
// people use them: phones, where the cover sheet used to push every card below
// the fold and the deck sat under a nested scroller, and desktops, where both
// grids drew thumbnails.
import { test, expect, bootToMainMenu, SLOW } from './helpers/session.js';

// Seeds the store for the next reload, after the shared boot's own seed (init
// scripts run in registration order), then reloads to the main menu.
async function reseed(page, patch) {
  await page.addInitScript((p) => {
    const raw = localStorage.getItem('terrible-teddies-storage');
    const stored = raw ? JSON.parse(raw) : { state: {}, version: 3 };
    Object.assign(stored.state, p);
    localStorage.setItem('terrible-teddies-storage', JSON.stringify(stored));
  }, patch);
  await page.reload();
  await expect(page.getByRole('button', { name: 'Battle', exact: true })).toBeVisible(SLOW);
}

async function openCollection(page) {
  await page.getByRole('button', { name: 'Collection', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Card Collection' })).toBeVisible(SLOW);
  // The tiles stagger in; measure them where they come to rest.
  await expect(page.getByRole('button', { name: /^View / }).first()).toBeVisible(SLOW);
}

const ids = (n) => Array.from({ length: n }, (_, i) => i + 1);

test.beforeEach(async ({ page }) => {
  await bootToMainMenu(page);
});

for (const viewport of [{ width: 320, height: 640 }, { width: 390, height: 844 }]) {
  test.describe(`collection on a ${viewport.width}x${viewport.height} phone`, () => {
    test.use({ viewport });

    test('opens on at least one full row of cards', async ({ page }) => {
      await openCollection(page);
      const tiles = page.getByRole('button', { name: /^View / });
      const first = await tiles.first().boundingBox();
      // A full row: the first row's cards end above the bottom of the screen.
      // The tally, the tiers and three rows of filters used to take the whole
      // of a 320x640 screen, so the album opened on no card at all.
      expect(first.y + first.height, 'first row of cards ends below the fold').toBeLessThanOrEqual(viewport.height);
    });

    test('puts every filter on one row that scrolls sideways, all of it keyboard reachable', async ({ page }) => {
      await openCollection(page);
      const strip = page.locator('[data-collection-filters]');
      const keys = strip.getByRole('button');
      const count = await keys.count();
      expect(count).toBe(2 + 4 + 6); // Show, Type, Rarity
      const tops = await keys.evaluateAll((els) => els.map((el) => Math.round(el.getBoundingClientRect().top)));
      expect(new Set(tops).size, `filter keys on ${new Set(tops).size} rows`).toBe(1);

      // Tab from the first key to the last: each one takes the focus in turn,
      // and the row scrolls the focused key into the strip.
      const box = await strip.boundingBox();
      await keys.first().focus();
      for (let i = 1; i < count; i++) await page.keyboard.press('Tab');
      const last = keys.nth(count - 1);
      await expect(last).toBeFocused();
      await expect(last).toHaveText(/common/i);
      const lastBox = await last.boundingBox();
      expect(lastBox.x).toBeGreaterThanOrEqual(box.x - 1);
      expect(lastBox.x + lastBox.width).toBeLessThanOrEqual(box.x + box.width + 1);
      await page.keyboard.press('Enter');
      await expect(last).toHaveAttribute('aria-pressed', 'true');
    });
  });
}

test.describe('collection filters on a long album', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('stay in reach at the top of the screen while the album scrolls', async ({ page }) => {
    await reseed(page, { ownedCards: ids(40) });
    await openCollection(page);
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    const strip = page.locator('[data-collection-filters]');
    await expect.poll(async () => (await strip.boundingBox()).y).toBeLessThanOrEqual(1);
    // On top of the cards, not just positioned there: the key under its
    // centre is the one that gets the tap.
    const missing = strip.getByRole('button', { name: /^Missing/ });
    const b = await missing.boundingBox();
    const hit = await page.evaluate(([x, y]) => document.elementFromPoint(x, y)?.closest('button')?.textContent, [b.x + b.width / 2, b.y + b.height / 2]);
    expect(hit).toMatch(/^Missing/);
  });

  test('a card focused from the keyboard scrolls into view below the strip, not under it', async ({ page }) => {
    await reseed(page, { ownedCards: ids(40) });
    await openCollection(page);
    const strip = page.locator('[data-collection-filters]');
    const tiles = page.getByRole('button', { name: /^View / });
    // Park card 12 under the stuck strip, then Shift+Tab onto it from card 13.
    await tiles.nth(13).focus();
    const top = await tiles.nth(12).evaluate((el) => el.getBoundingClientRect().top + window.scrollY);
    await page.evaluate((y) => window.scrollTo(0, y - 20), top);
    await page.keyboard.press('Shift+Tab');
    await expect(tiles.nth(12)).toBeFocused();
    await expect.poll(async () => {
      const t = await tiles.nth(12).boundingBox();
      const s = await strip.boundingBox();
      return t.y - (s.y + s.height);
    }, { message: 'focused card is (partly) under the filter strip' }).toBeGreaterThanOrEqual(0);
  });
});

test.describe('card grids on a desktop', () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test('draw the cards larger than hand size, with art that is not an upscaled thumbnail', async ({ page }) => {
    await openCollection(page);
    const tile = page.getByRole('button', { name: /^View / }).first();
    const box = await tile.boundingBox();
    // Hand size is 96px; .card-zoom draws it at 1.5x from lg.
    expect(box.width).toBeGreaterThanOrEqual(140);
    const srcset = await tile.locator('img').first().getAttribute('srcset');
    expect(srcset, 'zoomed card art offers the original').toContain('768w');

    await page.getByRole('button', { name: '← Menu' }).click();
    await page.getByRole('button', { name: 'Deck Builder', exact: true }).click();
    const add = page.getByRole('button', { name: /^Add .+ to deck$/ }).first();
    await expect(add).toBeVisible(SLOW);
    expect((await add.boundingBox()).width).toBeGreaterThanOrEqual(140);
    expect(await add.locator('img').first().getAttribute('srcset')).toContain('768w');
  });
});

test.describe('card grids on a phone', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('keep hand-size cards on the thumbnail alone', async ({ page }) => {
    await openCollection(page);
    const tile = page.getByRole('button', { name: /^View / }).first();
    expect(Math.round((await tile.boundingBox()).width)).toBe(96);
    // Asked responsively here, a 2x phone would fetch every 768px original.
    const img = tile.locator('img').first();
    await expect(img).toHaveAttribute('src', /\/cards\/thumbs\//);
    expect(await img.getAttribute('srcset')).toBeNull();
  });
});
