// The pack reveal and the two storefronts, end to end.
//
// Every test here pins something the audit found broken on a phone: a card
// left alone on its own row and cut off at the bottom (320px), the last three
// of a Legendary pack turning below the fold (390px), the guaranteed card
// spent on the first flip, a reveal the player could only watch, and a
// storefront whose unaffordable tiles went dead. None of it depends on what a
// pack happens to pull: the assertions hold for any roll.
import { test, expect, bootToMainMenu, SLOW } from './helpers/session.js';

const RANK = ['common', 'uncommon', 'rare', 'epic', 'legendary'];

test.beforeEach(async ({ page }) => {
  await bootToMainMenu(page);
});

// Patch the seeded save (after bootToMainMenu's own seed, which runs first on
// every load) and reload into it.
async function seed(page, patch) {
  await page.addInitScript((p) => {
    const raw = localStorage.getItem('terrible-teddies-storage');
    const stored = raw ? JSON.parse(raw) : { state: {}, version: 3 };
    Object.assign(stored.state, p);
    localStorage.setItem('terrible-teddies-storage', JSON.stringify(stored));
  }, patch);
  await page.reload();
  await expect(page.getByRole('button', { name: 'Battle', exact: true })).toBeVisible(SLOW);
}

async function openCardPacks(page) {
  await page.getByRole('button', { name: 'Card Packs', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Card packs' });
  await expect(dialog).toBeVisible(SLOW);
  return dialog;
}

const turnButton = (dialog, n) => dialog.getByRole('button', { name: new RegExp(`^Turn over card ${n}(,|$)`) });

// Taps card n if it is still face down. The idle fallback may turn it first
// (that is its job), so a vanished button is not a failure — just bounded.
async function tap(dialog, n) {
  const button = turnButton(dialog, n);
  if (await button.count()) await button.click({ timeout: 2_000 }).catch(() => {});
}

// The table's rows, as card counts, read from the layout itself.
const tableRows = (page) => page.locator('[data-reveal-table]').evaluate(
  (t) => [...t.children].map((row) => row.querySelectorAll('[data-reveal-card]').length)
);

// Turns every face-down card on the table by tapping it, asserting each one
// is wholly on screen at the moment it turns. Returns their rarities.
async function turnWave(page, dialog, first, last, viewport) {
  const rarities = [];
  for (let n = first; n <= last; n++) {
    await tap(dialog, n);
    const card = page.locator('[data-reveal-card]').nth(n - first);
    await expect(card).toHaveAttribute('data-reveal-card', 'up', SLOW);
    const box = await card.boundingBox();
    expect(box, `card ${n} has no box`).not.toBeNull();
    expect(box.y, `card ${n} turned above the fold`).toBeGreaterThanOrEqual(0);
    expect(box.y + box.height, `card ${n} turned below the fold`).toBeLessThanOrEqual(viewport.height);
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(viewport.width);
  }
  const captions = await page.locator('[data-reveal-card]').evaluateAll(
    (cards) => cards.map((c) => c.parentElement.querySelector(':scope > .label-caps')?.textContent?.trim())
  );
  rarities.push(...captions);
  return rarities;
}

for (const viewport of [{ width: 320, height: 640 }, { width: 390, height: 844 }]) {
  test.describe(`at ${viewport.width}x${viewport.height}`, () => {
    test.use({ viewport });

    test('a five-card pack deals in balanced rows and every card turns on screen', async ({ page }) => {
      await seed(page, { cardPacks: 1, premiumPacks: 0, legendaryPacks: 0 });
      const dialog = await openCardPacks(page);
      await dialog.getByRole('button', { name: /^Open Pack/ }).click();
      await expect(turnButton(dialog, 1)).toBeVisible(SLOW);

      const rows = await tableRows(page);
      expect(rows.reduce((a, b) => a + b, 0)).toBe(5);
      expect(rows.every((n) => n > 1), `a card was left alone on a row: ${rows.join(' + ')}`).toBe(true);

      const rarities = await turnWave(page, dialog, 1, 5, viewport);
      // The best card turns last: the display order never steps down.
      const ranks = rarities.map((r) => RANK.indexOf(r));
      expect(ranks, rarities.join(', ')).toEqual([...ranks].sort((a, b) => a - b));

      // The way on is on screen when it is over.
      const done = dialog.getByRole('button', { name: 'Done' });
      await expect(done).toBeVisible(SLOW);
      await expect.poll(async () => {
        const b = await done.boundingBox();
        return b && b.y + b.height <= viewport.height;
      }, SLOW).toBe(true);
    });

    test('a Legendary pack deals two waves of five and turns the legendary last', async ({ page }) => {
      await seed(page, { cardPacks: 0, premiumPacks: 0, legendaryPacks: 1 });
      const dialog = await openCardPacks(page);
      await dialog.getByRole('button', { name: /^Open Legendary Pack/ }).click();
      await expect(turnButton(dialog, 1)).toBeVisible(SLOW);

      expect(await tableRows(page)).toEqual([3, 2]);
      const first = await turnWave(page, dialog, 1, 5, viewport);

      const next = dialog.getByRole('button', { name: 'Next 5' });
      await expect(next).toBeVisible(SLOW);
      await next.click();
      await expect(turnButton(dialog, 6)).toBeVisible(SLOW);
      expect(await tableRows(page)).toEqual([3, 2]);
      const second = await turnWave(page, dialog, 6, 10, viewport);

      const all = [...first, ...second];
      expect(all).toHaveLength(10);
      expect(all[9]).toBe('legendary');
      const ranks = all.map((r) => RANK.indexOf(r));
      expect(ranks, all.join(', ')).toEqual([...ranks].sort((a, b) => a - b));
    });
  });
}

test('a face-down card turns on a key, and focus walks on to the next', async ({ page }) => {
  await seed(page, { cardPacks: 1, premiumPacks: 0, legendaryPacks: 0 });
  const dialog = await openCardPacks(page);
  await dialog.getByRole('button', { name: /^Open Pack/ }).click();
  const first = turnButton(dialog, 1);
  await expect(first).toBeFocused(SLOW);

  // Nothing about a card is in the DOM before it turns: no art, no name.
  const down = page.locator('[data-reveal-card="down"]');
  await expect(down).toHaveCount(5);
  await expect(down.locator('img')).toHaveCount(0);
  await expect(down.locator('[title]')).toHaveCount(0);

  await page.keyboard.press('Enter');
  await expect(page.locator('[data-reveal-card]').first()).toHaveAttribute('data-reveal-card', 'up');
  await expect(turnButton(dialog, 2)).toBeFocused(SLOW);
  await page.keyboard.press(' ');
  await expect(page.locator('[data-reveal-card]').nth(1)).toHaveAttribute('data-reveal-card', 'up');
});

test('Reveal all turns the rest at once, and both waves can be looked at after', async ({ page }) => {
  await seed(page, { cardPacks: 0, premiumPacks: 0, legendaryPacks: 1 });
  const dialog = await openCardPacks(page);
  await dialog.getByRole('button', { name: /^Open Legendary Pack/ }).click();
  await expect(turnButton(dialog, 1)).toBeVisible(SLOW);

  await dialog.getByRole('button', { name: 'Reveal all' }).click();
  await expect(dialog.getByRole('button', { name: 'Done' })).toBeVisible(SLOW);
  await expect(page.locator('[data-reveal-card="down"]')).toHaveCount(0);
  await expect(page.locator('[data-reveal-card="up"]')).toHaveCount(5);
  const captions = await page.locator('[data-reveal-card]').evaluateAll(
    (cards) => cards.map((c) => c.parentElement.querySelector(':scope > .label-caps')?.textContent?.trim())
  );
  expect(captions[captions.length - 1]).toBe('legendary');

  const firstFive = dialog.getByRole('button', { name: 'Cards 1–5' });
  await firstFive.click();
  await expect(firstFive).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('[data-reveal-card="up"]')).toHaveCount(5);
});

test('an epic or legendary holds a beat before it turns', async ({ page }) => {
  await seed(page, { cardPacks: 0, premiumPacks: 0, legendaryPacks: 1 });
  const dialog = await openCardPacks(page);
  await dialog.getByRole('button', { name: /^Open Legendary Pack/ }).click();
  await expect(turnButton(dialog, 1)).toBeVisible(SLOW);
  await turnWave(page, dialog, 1, 5, page.viewportSize());
  await dialog.getByRole('button', { name: 'Next 5' }).click();
  await expect(turnButton(dialog, 6)).toBeVisible(SLOW);
  for (let n = 6; n <= 9; n++) await tap(dialog, n);
  // Card 9 may be an epic in its own beat: let it land first.
  await expect(page.locator('[data-reveal-card="down"]')).toHaveCount(1, SLOW);

  // The legendary, named by its light for a screen reader.
  const legend = dialog.getByRole('button', { name: 'Turn over card 10, glowing gold' });
  await expect(legend).toBeVisible(SLOW);
  await legend.click();
  // Held: still face down, its light charged, its control spent.
  await expect(page.locator('[data-tease="legendary"]')).toHaveAttribute('data-charged', '');
  await expect(legend).toHaveAttribute('aria-disabled', 'true');
  await expect(page.locator('[data-reveal-card]').last()).toHaveAttribute('data-reveal-card', 'down');
  // ...and then it turns.
  await expect(page.locator('[data-reveal-card]').last()).toHaveAttribute('data-reveal-card', 'up', SLOW);
});

test('with Animations off a pack opens straight to its cards, and nothing pulses', async ({ page }) => {
  await seed(page, { cardPacks: 0, premiumPacks: 0, legendaryPacks: 1, animationsEnabled: false });
  const dialog = await openCardPacks(page);
  await dialog.getByRole('button', { name: /^Open Legendary Pack/ }).click();
  // No tear, no deal, no turning: the next thing to do is already focused.
  await expect(dialog.getByRole('button', { name: 'Done' })).toBeFocused({ timeout: 1_500 });
  await expect(page.locator('[data-reveal-card="up"]')).toHaveCount(5);
  await expect(page.locator('button[data-turn]')).toHaveCount(0);
  await expect(page.locator('.reveal-tease')).toHaveCount(0);
});

// Emulated through contextOptions on purpose: `use.reducedMotion` (which
// playwright.config.js sets) is not a Playwright Test option, so it does not
// reach the browser — matchMedia reports no preference unless it is passed
// as a context option, as here.
test.describe('with motion allowed', () => {
  test.use({ contextOptions: { reducedMotion: 'no-preference' } });

  test('a face-down rare-or-better breathes in its tier light', async ({ page }) => {
    await seed(page, { cardPacks: 0, premiumPacks: 0, legendaryPacks: 1 });
    const dialog = await openCardPacks(page);
    await dialog.getByRole('button', { name: /^Open Legendary Pack/ }).click();
    await expect(turnButton(dialog, 1)).toBeVisible(SLOW);
    for (let n = 1; n <= 5; n++) await tap(dialog, n);
    await dialog.getByRole('button', { name: 'Next 5' }).click();
    const light = page.locator('[data-tease="legendary"]');
    await expect(light).toHaveCount(1, SLOW);
    expect(await light.evaluate((el) => getComputedStyle(el).animationName)).toBe('reveal-tease');
  });
});

test.describe('with reduced motion', () => {
  test.use({ contextOptions: { reducedMotion: 'reduce' } });

  test('the tier light holds still', async ({ page }) => {
    expect(await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches)).toBe(true);
    await seed(page, { cardPacks: 0, premiumPacks: 0, legendaryPacks: 1 });
    const dialog = await openCardPacks(page);
    await dialog.getByRole('button', { name: /^Open Legendary Pack/ }).click();
    await expect(turnButton(dialog, 1)).toBeVisible(SLOW);
    for (let n = 1; n <= 5; n++) await tap(dialog, n);
    await dialog.getByRole('button', { name: 'Next 5' }).click();
    const light = page.locator('[data-tease="legendary"]');
    await expect(light).toHaveCount(1, SLOW);
    expect(await light.evaluate((el) => getComputedStyle(el).animationName)).toBe('none');
    // Still lit, just not breathing.
    expect(Number(await light.evaluate((el) => getComputedStyle(el).opacity))).toBeGreaterThan(0);
  });
});

test("the pull's art is fetched before the first card turns, and faces load eagerly", async ({ page }) => {
  const requested = new Set();
  page.on('request', (r) => {
    const m = r.url().match(/\/cards\/thumbs\/(\d+)\.webp/);
    if (m) requested.add(m[1]);
  });
  await seed(page, { cardPacks: 0, premiumPacks: 0, legendaryPacks: 1 });
  const dialog = await openCardPacks(page);
  await dialog.getByRole('button', { name: /^Open Legendary Pack/ }).click();
  await expect(turnButton(dialog, 1)).toBeVisible(SLOW);
  const beforeFirstTurn = new Set(requested);
  await expect(page.locator('[data-reveal-card="up"]')).toHaveCount(0);

  await dialog.getByRole('button', { name: 'Reveal all' }).click();
  await expect(dialog.getByRole('button', { name: 'Done' })).toBeVisible(SLOW);
  const faces = async () => page.locator('[data-reveal-card] img').evaluateAll(
    (imgs) => imgs.map((i) => ({ src: i.getAttribute('src'), loading: i.getAttribute('loading') }))
  );
  const shown = [...await faces()];
  await dialog.getByRole('button', { name: 'Cards 1–5' }).click();
  shown.push(...await faces());
  expect(shown).toHaveLength(10);
  for (const { src, loading } of shown) {
    expect(loading).toBe('eager');
    const id = src.match(/\/cards\/thumbs\/(\d+)\.webp/)?.[1];
    expect(id, `face art ${src} is not a thumb`).toBeTruthy();
    expect(beforeFirstTurn.has(id), `card ${id}'s art was not fetched before the first turn`).toBe(true);
  }
});

test('an unaffordable Card Packs tile stays live, says the gap, and answers with a toast', async ({ page }) => {
  await seed(page, { coins: 50, gems: 0, cardPacks: 0, premiumPacks: 0, legendaryPacks: 0 });
  const dialog = await openCardPacks(page);
  const tile = dialog.getByRole('button', { name: 'Buy Card Pack for 200 coins' });
  await expect(tile).toBeEnabled();
  await expect(tile).toContainText(/Need 150( more)?/);
  await tile.click();
  await expect(page.getByText('Not enough coins').first()).toBeVisible(SLOW);
});

test("the Shop's odds open in their own dialog, and Escape closes only that", async ({ page }) => {
  await page.getByRole('button', { name: 'Shop', exact: true }).click();
  const shop = page.getByRole('dialog', { name: 'Shop' });
  await expect(shop).toBeVisible(SLOW);
  const viewOdds = shop.getByRole('button', { name: 'View odds' });
  await viewOdds.click();
  const odds = page.getByRole('dialog', { name: 'Pack odds' });
  await expect(odds).toBeVisible(SLOW);
  for (const tier of ['Card Pack', 'Premium Pack', 'Legendary Pack']) {
    await expect(odds.getByRole('region', { name: tier })).toBeVisible();
  }
  await expect(odds.getByRole('region', { name: 'Premium Pack' })).toContainText('First card');
  await page.keyboard.press('Escape');
  await expect(odds).toHaveCount(0);
  await expect(shop).toBeVisible();
  await expect(viewOdds).toBeFocused();
});
