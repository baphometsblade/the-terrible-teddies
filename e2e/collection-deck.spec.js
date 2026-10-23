// The two card screens — the Collection and the Deck Builder — at the sizes
// people use them: phones, where the cover sheet used to push every card below
// the fold and the deck sat under a nested scroller, and desktops, where both
// grids drew thumbnails.
import { test, expect, bootToMainMenu, SLOW } from './helpers/session.js';
// The rules tables the detail view reads, so these tests expect what the
// tables say rather than restating it (both modules are dependency-free).
import { abilityRules } from '../src/lib/abilities.js';
import { effectRules } from '../src/lib/effects.js';

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

      // Tab from the first key to the last and back: each one takes the focus
      // in turn, and the row scrolls it wholly into view, clear of the fade
      // over the row's right-hand end. Every key, not just the last: snapping
      // the row to its groups once left keys such as Special and Epic mostly
      // off the strip with the focus on them.
      const row = strip.locator('> div');
      const offRow = async () => row.evaluate((el, fade) => {
        const r = el.getBoundingClientRect();
        const k = document.activeElement.getBoundingClientRect();
        return k.left < r.left - 0.5 || k.right > r.right - fade + 0.5 ? document.activeElement.textContent : null;
      }, 24);
      await keys.first().focus();
      const missed = [];
      for (let i = 1; i < count; i++) {
        await page.keyboard.press('Tab');
        await expect(keys.nth(i)).toBeFocused();
        const off = await offRow();
        if (off) missed.push(off);
      }
      for (let i = count - 2; i >= 0; i--) {
        await page.keyboard.press('Shift+Tab');
        await expect(keys.nth(i)).toBeFocused();
        const off = await offRow();
        if (off) missed.push(off);
      }
      expect(missed, 'focused filter keys not wholly shown in the row').toEqual([]);
      const last = keys.nth(count - 1);
      await expect(last).toHaveText(/common/i);
      await last.focus();
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

  test('tabbing into the stuck strip leaves the album where it is', async ({ page }) => {
    await reseed(page, { ownedCards: ids(40) });
    await openCollection(page);
    await page.evaluate(() => window.scrollTo(0, 900));
    const at = await page.evaluate(() => window.scrollY);
    expect(at).toBeGreaterThan(300);
    const keys = page.locator('[data-collection-filters]').getByRole('button');
    // Scroll-padding on the page, to keep focused cards below the strip, once
    // applied to the strip's own keys too: tabbing into them scrolled the
    // album back to its top.
    await keys.first().focus();
    for (let i = 1; i < await keys.count(); i++) await page.keyboard.press('Tab');
    expect(await page.evaluate(() => window.scrollY)).toBe(at);
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

test.describe('collection filters at the narrowest tablet width', () => {
  test.use({ viewport: { width: 640, height: 900 } });

  test('stay inside their strip', async ({ page }) => {
    await openCollection(page);
    const strip = page.locator('[data-collection-filters]');
    const s = await strip.boundingBox();
    // From sm the groups wrap instead of scrolling; the six rarity keys were
    // wider than the strip from 640 to 649px and ran out past both its edges.
    const groups = await strip.locator('> div > div').evaluateAll((els) =>
      els.map((el) => { const r = el.getBoundingClientRect(); return [r.left, r.right]; }));
    expect(groups.length).toBe(3);
    for (const [left, right] of groups) {
      expect(left).toBeGreaterThanOrEqual(s.x);
      expect(right).toBeLessThanOrEqual(s.x + s.width);
    }
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

// ---------------------------------------------------------------------------
// Card detail
// ---------------------------------------------------------------------------

const detail = (page) => page.getByRole('dialog', { name: /details$/ });

// A stat in the detail view ("Ability", "Effect"): its value, and the line of
// rules text under it.
async function statParts(dialog, label) {
  const stat = dialog.locator('dt', { hasText: new RegExp(`^${label}$`, 'i') }).locator('..');
  const value = (await stat.locator('dd > span').first().innerText()).trim();
  const note = (await stat.locator('dd > p').innerText()).trim();
  return { value, note };
}

test.describe('card detail', () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test('shows the card as it is played, and says what its ability and effect do', async ({ page }) => {
    await openCollection(page);
    await page.getByRole('button', { name: 'View Shit-Talk Sally' }).click();
    const d = detail(page);
    await expect(d).toBeVisible(SLOW);

    // The real card at size: its frame, name, cost and stats, not bare art.
    const hero = d.locator('[data-card-hero]');
    await expect(hero).toContainText('Shit-Talk Sally');
    expect((await hero.boundingBox()).width).toBeGreaterThan(150);

    // The ability's rules text, not just its keyword.
    const ability = await statParts(d, 'Ability');
    expect(ability.note).not.toBe('');
    expect(ability.note).toBe(abilityRules(ability.value.toLowerCase()));

    // A trap's effect in words, with the amount its label states.
    await page.keyboard.press('Escape');
    await expect(d).toHaveCount(0, SLOW);
    await page.getByRole('button', { name: 'View Honey Trap' }).click();
    await expect(d).toBeVisible(SLOW);
    const effect = await statParts(d, 'Effect');
    const amount = Number(effect.value.match(/\d+/)[0]);
    expect(effect.note).toBe(effectRules({ type: 'trap', amount }));
  });

  test('pages through the album as it is filtered, by button and by arrow key', async ({ page }) => {
    await openCollection(page);
    // Traps only: paging follows the grid's visible order, not the catalog's.
    await page.locator('[data-collection-filters]').getByRole('button', { name: 'Trap', exact: true }).click();
    const tiles = page.getByRole('button', { name: /^View / });
    const names = (await tiles.evaluateAll((els) => els.map((el) => el.getAttribute('aria-label'))))
      .map((n) => n.replace(/^View /, ''));
    expect(names.length).toBeGreaterThan(1);

    await tiles.first().click();
    const d = detail(page);
    const heading = d.getByRole('heading', { level: 2 });
    await expect(heading).toHaveText(names[0]);
    await expect(d.locator('[data-card-position]')).toHaveText(`1 / ${names.length}`);

    await d.getByRole('button', { name: 'Next card' }).click();
    await expect(heading).toHaveText(names[1]);
    // The focus stays on the control that turned the page.
    await expect(d.getByRole('button', { name: 'Next card' })).toBeFocused();

    await page.keyboard.press('ArrowLeft');
    await expect(heading).toHaveText(names[0]);
    // Wraps: back from the first card is the last.
    await page.keyboard.press('ArrowLeft');
    await expect(heading).toHaveText(names[names.length - 1]);
    await page.keyboard.press('ArrowRight');
    await expect(heading).toHaveText(names[0]);
    await d.getByRole('button', { name: 'Previous card' }).click();
    await expect(heading).toHaveText(names[names.length - 1]);

    // Still heard after a click on the card's text, which is not a control:
    // the focus used to drop to <body> there, out of the panel's hearing.
    await d.locator('dl').click();
    await page.keyboard.press('ArrowRight');
    await expect(heading).toHaveText(names[0]);
  });

  test('shows the cached thumbnail at once and sharpens to the full art when it arrives', async ({ page }) => {
    // Hold the full-size originals back, as a slow phone network would.
    let release;
    const held = new Promise((resolve) => { release = resolve; });
    await page.route(/\/cards\/\d+\.webp$/, async (route) => {
      await held;
      await route.continue();
    });
    await openCollection(page);
    await page.getByRole('button', { name: 'View Shit-Talk Sally' }).click();
    const img = detail(page).locator('[data-card-hero] img');
    // Never an empty frame: the grid's thumbnail is there, loaded, while the
    // original is still on its way.
    await expect(img).toHaveAttribute('src', /\/cards\/thumbs\/\d+\.webp$/);
    // Decoding the cached thumb can take a frame or two on a loaded machine;
    // the full-size art is still held back here, so whatever this sees
    // loaded is the thumb.
    await expect.poll(() => img.evaluate((el) => el.complete && el.naturalWidth > 0), { timeout: 3000 }).toBe(true);
    await expect(img).toHaveAttribute('src', /\/cards\/thumbs\/\d+\.webp$/);

    release();
    await expect(img).toHaveAttribute('src', /\/cards\/\d+\.webp$/, SLOW);
    await expect.poll(() => img.evaluate((el) => el.complete && el.naturalWidth > 0)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Deck Builder
// ---------------------------------------------------------------------------

async function openDeckBuilder(page) {
  await page.getByRole('button', { name: 'Deck Builder', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Deck Builder' })).toBeVisible(SLOW);
  await expect(page.getByRole('button', { name: /^Add .+ to deck$/ }).first()).toBeVisible(SLOW);
}

const storedDeck = (page) => page.evaluate(() =>
  JSON.parse(localStorage.getItem('terrible-teddies-storage')).state.currentDeck);

const deckCount = (page) => page.locator('[data-deck-panel] h2');

// The pool tiles that can still take a copy.
const addable = (page) => page.getByRole('button', { name: /^Add .+ to deck$/ });

// Removes the deck's first card through its row's X.
async function removeFirstCard(page) {
  await page.locator('[data-deck-panel]').getByRole('button', { name: /^Remove .+ from deck$/ }).first().click();
}

// Whether any element under `selector` scrolls on its own (a nested scroller).
const innerScrollers = (page, selector) => page.locator(selector).evaluate((root) =>
  [root, ...root.querySelectorAll('*')].filter((el) => {
    const oy = getComputedStyle(el).overflowY;
    return (oy === 'auto' || oy === 'scroll') && el.scrollHeight > el.clientHeight + 1;
  }).length);

test.describe('deck builder on a phone', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('scrolls the pool with the page and keeps the deck bar on screen', async ({ page }) => {
    await reseed(page, { ownedCards: ids(40) });
    await openDeckBuilder(page);
    // The pool used to be a 500px box scrolling inside the page; the deck
    // list another one inside the deck panel.
    expect(await innerScrollers(page, '[data-deck-panel]')).toBe(0);
    const poolScrollers = await page.locator('section').first().evaluate((root) =>
      [...root.querySelectorAll('*')].filter((el) => ['auto', 'scroll'].includes(getComputedStyle(el).overflowY)).length);
    expect(poolScrollers).toBe(0);

    const bar = page.locator('[data-deck-bar]');
    await expect(bar).toBeVisible();
    await expect(bar).toContainText('10/10');
    // On the screen from the start, and still there halfway down the pool.
    for (const y of [0, 1200]) {
      await page.evaluate((to) => window.scrollTo(0, to), y);
      await expect.poll(async () => {
        const b = await bar.boundingBox();
        return b.y >= 0 && b.y + b.height <= 844;
      }, { message: `deck bar off screen at scrollY ${y}` }).toBe(true);
    }
  });

  test('a pool card focused from the keyboard is never under the bar', async ({ page }) => {
    await reseed(page, { ownedCards: ids(40) });
    await openDeckBuilder(page);
    const tiles = addable(page);
    const n = await tiles.count();
    await tiles.first().focus();
    const under = [];
    for (let i = 1; i < n; i++) {
      await page.keyboard.press('Tab');
      await expect(tiles.nth(i)).toBeFocused();
      // The card and its copy pips, against the bar where it is now.
      const hit = await page.evaluate(() => {
        const cell = document.activeElement.closest('[data-pool-cell]').getBoundingClientRect();
        const bar = document.querySelector('[data-deck-bar]').getBoundingClientRect();
        return cell.bottom > bar.top && cell.top < bar.bottom ? document.activeElement.getAttribute('aria-label') : null;
      });
      if (hit) under.push(hit);
    }
    expect(under, 'focused cards behind the deck bar').toEqual([]);

    // The bar's own controls are not moved for: focusing them leaves the
    // page where it is (scroll-padding on the page would have scrolled it).
    const at = await page.evaluate(() => window.scrollY);
    await page.keyboard.press('Tab');
    await expect(page.locator('[data-deck-bar]').getByRole('button', { name: /^View deck/ })).toBeFocused();
    expect(await page.evaluate(() => window.scrollY)).toBe(at);
  });

  test('the bar takes the player to the full deck list', async ({ page }) => {
    await openDeckBuilder(page);
    await page.locator('[data-deck-bar]').getByRole('button', { name: /^View deck/ }).click();
    const panel = page.locator('[data-deck-panel]');
    await expect.poll(async () => Math.round((await panel.boundingBox()).y)).toBeLessThanOrEqual(20);
    // Keyboard and screen-reader users carry on from the deck, not the pool.
    await expect(panel.locator('h2')).toBeFocused();
  });

  test('an added card lights its slot on the bar, once, and only with motion on', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await openDeckBuilder(page);
    await removeFirstCard(page);
    const bar = page.locator('[data-deck-bar]');
    await expect(bar).toContainText('9/10');
    await addable(page).first().click();
    await expect(bar).toContainText('10/10');
    const slot = bar.locator('[data-slot-new]');
    await expect(slot).toHaveCount(1);
    // It is the tenth slot: the one the add filled.
    expect(await slot.evaluate((el) => [...el.parentElement.children].indexOf(el))).toBe(9);
    const glowing = () => page.evaluate(() =>
      document.getAnimations().filter((a) => a.animationName === 'deck-slot-new').length);
    await expect.poll(glowing).toBeGreaterThan(0);

    // Reduced motion: the slot is still lit, but nothing plays.
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await removeFirstCard(page);
    await addable(page).first().click();
    await expect(bar).toContainText('10/10');
    expect(await glowing()).toBe(0);

    // And the in-game Animations switch (mirrored onto <html data-motion>).
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.evaluate(() => { document.documentElement.dataset.motion = 'off'; });
    await removeFirstCard(page);
    await addable(page).first().click();
    await expect(bar).toContainText('10/10');
    expect(await glowing()).toBe(0);
  });

  test('the slot does not glow again when the deck refills without an add', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await reseed(page, { savedDecks: [{ name: 'Traps', cards: [30, 30, 40, 40, 41, 41, 42, 42, 1, 1] }] });
    await openDeckBuilder(page);
    await removeFirstCard(page);
    await addable(page).first().click();
    const bar = page.locator('[data-deck-bar]');
    await expect(bar.locator('[data-slot-new]')).toHaveCount(1);
    // Down to nine, then back to ten by loading a saved deck: no card was
    // added, so nothing may light up as if one had been.
    await removeFirstCard(page);
    await expect(bar).toContainText('9/10');
    await page.getByRole('button', { name: 'Traps', exact: true }).click();
    await expect(bar).toContainText('10/10');
    await expect(page.locator('[data-slot-new]')).toHaveCount(0);
    expect(await page.evaluate(() =>
      document.getAnimations().filter((a) => a.animationName === 'deck-slot-new').length)).toBe(0);
  });

  test("the bar's Set as Current Deck sets the battle deck", async ({ page }) => {
    await openDeckBuilder(page);
    const before = await storedDeck(page);
    await removeFirstCard(page);
    await addable(page).last().click();
    const bar = page.locator('[data-deck-bar]');
    await bar.getByRole('button', { name: 'Set as Current Deck' }).click();
    await expect.poll(() => storedDeck(page)).not.toEqual(before);
    await expect(page.locator('[data-unsaved]')).toHaveCount(0);
  });
});

test.describe('deck builder toasts between sm and lg', () => {
  test.use({ viewport: { width: 768, height: 1024 } });

  test('sit clear of the deck bar', async ({ page }) => {
    await openDeckBuilder(page);
    // The seeded deck is full, so an add raises "Deck Full!".
    await addable(page).first().click();
    const toast = page.locator('.toast-viewport > li').first();
    await expect(toast).toBeVisible(SLOW);
    const t = await toast.boundingBox();
    const b = await page.locator('[data-deck-bar]').boundingBox();
    expect(t.y + t.height, 'toast covers the deck bar').toBeLessThanOrEqual(b.y);
  });
});

test.describe('deck builder on a desktop', () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test('has no deck bar, so each deck control exists once', async ({ page }) => {
    await openDeckBuilder(page);
    await expect(page.locator('[data-deck-bar]')).toBeHidden();
    await expect(page.getByRole('button', { name: 'Set as Current Deck' })).toHaveCount(1);
  });

  test('keeps the whole deck panel on screen while a long pool scrolls past it', async ({ page }) => {
    const deck = [1, 2, 3, 4, 5, 6, 30, 40, 41, 42];
    await reseed(page, {
      ownedCards: ids(40),
      savedDecks: ['Starter', 'Aggro', 'Control', 'Traps', 'Memes'].map((name) => ({ name, cards: deck })),
    });
    await openDeckBuilder(page);
    // The pool no longer has a scroller of its own, so the page is long; a
    // sidebar taller than the window kept its foot out of sight until the end.
    await page.evaluate(() => window.scrollTo(0, 900));
    const panel = page.locator('[data-deck-panel]');
    // Stuck (lg:top-4), or already being carried up by the end of the row.
    await expect.poll(async () => Math.round((await panel.boundingBox()).y)).toBeLessThanOrEqual(16);
    const p = await panel.boundingBox();
    expect(p.y + p.height, 'deck panel runs off the bottom of the screen').toBeLessThanOrEqual(800);
    const set = await page.getByRole('button', { name: 'Set as Current Deck' }).boundingBox();
    expect(set.y + set.height).toBeLessThanOrEqual(800);
  });
});

test.describe('unsaved deck edits', () => {
  test('are marked, and "← Menu" asks before dropping them', async ({ page }) => {
    await openDeckBuilder(page);
    const before = await storedDeck(page);
    await expect(page.locator('[data-unsaved]')).toHaveCount(0);
    await removeFirstCard(page);
    await expect(page.locator('[data-unsaved]')).toHaveText(/Unsaved changes/i);

    await page.getByRole('button', { name: '← Menu' }).click();
    const ask = page.getByRole('dialog', { name: 'Leave without saving?' });
    await expect(ask).toBeVisible(SLOW);
    // The safe answer takes the focus, and Escape means it too.
    await expect(ask.getByRole('button', { name: 'Keep editing' })).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(ask).toHaveCount(0, SLOW);
    await expect(deckCount(page)).toContainText('9/10');

    await page.getByRole('button', { name: '← Menu' }).click();
    await ask.getByRole('button', { name: 'Discard changes' }).click();
    await expect(page.getByRole('button', { name: 'Battle', exact: true })).toBeVisible(SLOW);
    expect(await storedDeck(page)).toEqual(before);
  });

  test('"← Menu" with nothing changed just leaves', async ({ page }) => {
    await openDeckBuilder(page);
    // A card taken out and put back is not a change (order does not count):
    // the deck's first row and the pool's first tile are both card 1.
    const first = page.locator('[data-deck-panel]').getByRole('button', { name: /^Remove .+ from deck$/ }).first();
    const name = (await first.getAttribute('aria-label')).replace(/^Remove (.+) from deck$/, '$1');
    await first.click();
    await expect(page.locator('[data-unsaved]')).toHaveCount(1);
    await page.getByRole('button', { name: `Add ${name} to deck` }).click();
    await expect(page.locator('[data-unsaved]')).toHaveCount(0);
    await page.getByRole('button', { name: '← Menu' }).click();
    await expect(page.getByRole('button', { name: 'Battle', exact: true })).toBeVisible(SLOW);
    await expect(page.getByRole('dialog')).toHaveCount(0);
  });

  test('are cleared by setting the deck', async ({ page }) => {
    await openDeckBuilder(page);
    await removeFirstCard(page);
    await addable(page).last().click();
    await expect(page.locator('[data-unsaved]')).toHaveCount(1);
    await page.getByRole('button', { name: 'Set as Current Deck' }).click();
    await expect(page.locator('[data-unsaved]')).toHaveCount(0);
    await page.getByRole('button', { name: '← Menu' }).click();
    await expect(page.getByRole('button', { name: 'Battle', exact: true })).toBeVisible(SLOW);
  });

  test('survive the window losing and regaining focus', async ({ page }) => {
    await openDeckBuilder(page);
    await removeFirstCard(page);
    await expect(deckCount(page)).toContainText('9/10');
    // Coming back to the window re-reads the save (useRehydrateOnFocus),
    // which used to reset the editor to the stored deck.
    await page.evaluate(() => window.dispatchEvent(new Event('focus')));
    await page.waitForTimeout(300);
    await expect(deckCount(page)).toContainText('9/10');
    await expect(page.locator('[data-unsaved]')).toHaveCount(1);
  });

  test('loading a saved deck says it is not the battle deck until it is set', async ({ page }) => {
    await reseed(page, {
      savedDecks: [
        { name: 'Traps', cards: [30, 30, 40, 40, 41, 41, 42, 42, 1, 1] },
        { name: 'Starter', cards: [42, 41, 40, 30, 6, 5, 4, 3, 2, 1] },
      ],
    });
    await openDeckBuilder(page);
    await page.getByRole('button', { name: 'Traps', exact: true }).click();
    await expect(page.locator('.toast-viewport')).toContainText("isn't your battle deck yet");
    // Not the battle deck, but not unsaved either: it is still on the shelf.
    await expect(page.locator('[data-unset]')).toHaveText(/Not your battle deck yet/i);
    await expect(page.locator('[data-unsaved]')).toHaveCount(0);
    // The battle deck, in another order: already set, and nothing to say.
    await page.getByRole('button', { name: 'Starter', exact: true }).click();
    await expect(page.locator('.toast-viewport')).toContainText("already your battle deck");
    await expect(page.locator('[data-unsaved], [data-unset]')).toHaveCount(0);
  });

  test('"← Menu" with a saved deck loaded just leaves, since it loses nothing', async ({ page }) => {
    await reseed(page, { savedDecks: [{ name: 'Traps', cards: [30, 30, 40, 40, 41, 41, 42, 42, 1, 1] }] });
    await openDeckBuilder(page);
    const before = await storedDeck(page);
    await page.getByRole('button', { name: 'Traps', exact: true }).click();
    await expect(page.locator('[data-unset]')).toHaveCount(1);
    // "Leave now and they're lost" was untrue here: Traps is still saved.
    await page.getByRole('button', { name: '← Menu' }).click();
    await expect(page.getByRole('button', { name: 'Battle', exact: true })).toBeVisible(SLOW);
    await expect(page.getByRole('dialog')).toHaveCount(0);
    expect(await storedDeck(page)).toEqual(before);

    // Edited after loading, it is unsaved again, and leaving asks.
    await openDeckBuilder(page);
    await page.getByRole('button', { name: 'Traps', exact: true }).click();
    await removeFirstCard(page);
    await expect(page.locator('[data-unsaved]')).toHaveText(/Unsaved changes/i);
    await page.getByRole('button', { name: '← Menu' }).click();
    await expect(page.getByRole('dialog', { name: 'Leave without saving?' })).toBeVisible(SLOW);
  });
});
