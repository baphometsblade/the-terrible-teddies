// The app's shell: the main menu's own controls, the sign-in screen's art,
// browser Back, document titles and focus between screens, and the hand-off
// from the pre-JS loader.
import AxeBuilder from '@axe-core/playwright';
import { test, expect, bootToMainMenu, SLOW } from './helpers/session.js';

test.describe('the main menu', () => {
  test.beforeEach(async ({ page }) => {
    await bootToMainMenu(page);
  });

  // Each tile used to be both what was hovered and what the hover lifted, so
  // a pointer on its bottom 3px fell off it as it rose: the next twitch of
  // the hand unhovered it, it dropped back under the pointer, the next one
  // hovered it again, and the tile shook for as long as the pointer stayed.
  // A hand is never still, so the pointer here twitches by a pixel. With
  // motion allowed, as players have it.
  test('a pointer resting on a tile\'s bottom edge holds it lifted, still', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.reload();
    for (const name of ['Shop', 'Battle']) {
      const tile = page.getByRole('button', { name, exact: true });
      await expect(tile).toBeVisible(SLOW);
      await page.waitForTimeout(1200); // the entrance
      const rest = await tile.boundingBox();
      const x = rest.x + rest.width / 2;
      const y = rest.y + rest.height - 1;
      await page.mouse.move(x, y);
      await page.waitForTimeout(600); // the lift
      const tops = [];
      for (let i = 0; i < 16; i += 1) {
        await page.mouse.move(x + (i % 2), y);
        await page.waitForTimeout(60);
        tops.push(Math.round((await tile.boundingBox()).y * 10) / 10);
      }
      expect(new Set(tops).size, `${name} moves under a resting pointer: ${tops.join(', ')}`).toBe(1);
      expect(tops[0], `${name} is not lifted`).toBeLessThan(rest.y);
      await page.mouse.move(0, 0);
    }
  });

  test.describe('at 320px', () => {
    test.use({ viewport: { width: 320, height: 640 } });

    test('every header control is a 44px target, on one row', async ({ page }) => {
      await page.waitForTimeout(800); // the header's entrance
      const boxes = [];
      for (const name of ['Daily rewards', 'How to play', 'Settings']) {
        const box = await page.getByRole('button', { name }).boundingBox();
        expect(box.width, `${name} is narrower than 44px`).toBeGreaterThanOrEqual(44);
        expect(box.height, `${name} is shorter than 44px`).toBeGreaterThanOrEqual(44);
        boxes.push(box);
      }
      expect(new Set(boxes.map((b) => Math.round(b.y))).size, 'the header row wraps').toBe(1);
    });
  });

  // Holding a finger on a tile or a card selected its text and, on iOS,
  // opened the Copy / Save Image callout. The menu and the two card grids are
  // game surfaces now, like the board and the pack reveal.
  test('a held finger selects nothing on the menu or in the card grids', async ({ page }) => {
    const selectable = (locator) => locator.evaluate((el) => getComputedStyle(el).userSelect);
    expect(await selectable(page.getByRole('button', { name: 'Shop', exact: true }))).toBe('none');
    await page.getByRole('button', { name: 'Collection', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Card Collection' })).toBeVisible(SLOW);
    expect(await selectable(page.locator('.card-zoom').first())).toBe('none');
    await page.getByRole('button', { name: '← Menu' }).click();
    await page.getByRole('button', { name: 'Deck Builder', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Deck Builder' })).toBeVisible(SLOW);
    expect(await selectable(page.locator('.card-zoom').first())).toBe('none');
  });
});

// The sign-in screen is every new player's first look at the game, and it
// showed no card art at all. From lg up, where there is room beside the
// form, it fans three of the set's cards, as the menu fans a player's own.
test.describe('the sign-in screen', () => {
  const signedOut = async (page) => {
    await page.route('**testproject.supabase.co/**', (r) => r.fulfill({ json: {} }));
    await page.route('https://*.posthog.com/**', (r) => r.abort());
    await page.goto('/');
    await expect(page.getByRole('button', { name: 'Sign In' })).toBeVisible(SLOW);
  };

  test.describe('on a desktop', () => {
    test.use({ viewport: { width: 1280, height: 800 } });

    test('shows the card fan beside the form, as decoration only', async ({ page }) => {
      await signedOut(page);
      const fan = page.locator('main [aria-hidden="true"]').filter({ has: page.locator('img') });
      await expect(fan).toHaveCount(1);
      await expect(fan.locator('img')).toHaveCount(3);
      // Real art, loaded, beside (not above) the form.
      await expect.poll(() => fan.locator('img').evaluateAll((imgs) => imgs.every((i) => i.complete && i.naturalWidth > 0))).toBe(true);
      const art = await fan.boundingBox();
      const form = await page.locator('form').boundingBox();
      expect(art.x + art.width, 'the fan overlaps the form').toBeLessThanOrEqual(form.x);
      // Nothing in it takes a tab stop or a pointer.
      expect(await fan.evaluate((el) => el.querySelectorAll('[tabindex], button, a').length)).toBe(0);
      expect(await fan.evaluate((el) => getComputedStyle(el).pointerEvents)).toBe('none');
      const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
      expect(results.violations.map((v) => `${v.id}: ${v.nodes.length} node(s)`).join('\n')).toBe('');
    });
  });

  test.describe('on a phone', () => {
    test.use({ viewport: { width: 390, height: 844 } });

    test('leaves the fan out, so Sign In stays well above the fold', async ({ page }) => {
      await signedOut(page);
      await expect(page.locator('main img')).toHaveCount(0);
      const signIn = await page.getByRole('button', { name: 'Sign In' }).boundingBox();
      expect(signIn.y + signIn.height).toBeLessThanOrEqual(844);
    });
  });
});
