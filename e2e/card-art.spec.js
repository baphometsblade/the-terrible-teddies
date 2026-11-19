// The collection is where a missing plate used to show the browser's broken
// image. Every card picture that stays on screen has to have decoded, and a
// card with no file keeps the felt back instead of a dead <img>.
import { test, expect, bootToMainMenu, SLOW } from './helpers/session.js';

const settled = async (page) => {
  await page.evaluate(async () => {
    const root = document.scrollingElement;
    const height = root.scrollHeight;
    for (let y = 0; y < height; y += 280) {
      root.scrollTo(0, y);
      await new Promise((resolve) => setTimeout(resolve, 40));
    }
  });
  await expect.poll(async () => page.evaluate(() => {
    const imgs = [...document.querySelectorAll('[data-art] img')]
      .filter((img) => !img.closest('.hidden'));
    const pending = imgs.filter((img) => !img.complete).length;
    const broken = imgs
      .filter((img) => img.complete && !(img.naturalWidth > 0))
      .map((img) => img.getAttribute('src'));
    return { pending, broken };
  }), { timeout: 20_000 }).toEqual({ pending: 0, broken: [] });
};

test('the collection has no broken card images', async ({ page }) => {
  await bootToMainMenu(page);
  await page.getByRole('button', { name: 'Collection', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Card Collection' })).toBeVisible(SLOW);
  await expect(page.getByRole('button', { name: /^View / }).first()).toBeVisible(SLOW);
  await settled(page);

  // Every card ships its art now, so nothing falls back to the felt back.
  await page.getByRole('button', { name: /^Missing\b/ }).click();
  await settled(page);
  expect(await page.locator('[data-art] img:visible').count()).toBeGreaterThan(0);
  expect(await page.locator('[data-art] [data-art-frame]:visible').count()).toBe(0);
});

test('a card whose plate is gone keeps the felt back, not a dead image', async ({ page }) => {
  // Take Chuck's Crew art away: those cards must show the back, never a broken icon.
  await page.route(/\/cards\/(?:(?:thumbs|mid)\/)?ck-[a-z-]+\.(?:webp|avif)$/, (route) => route.fulfill({ status: 404, body: '' }));
  await bootToMainMenu(page);
  await page.getByRole('button', { name: 'Collection', exact: true }).click();
  await expect(page.getByRole('button', { name: /^View / }).first()).toBeVisible(SLOW);
  await page.getByRole('button', { name: /^Missing\b/ }).click();
  await settled(page);
  expect(await page.locator('[data-art] [data-art-frame]:visible').count()).toBeGreaterThan(0);
});

// Chromium decodes AVIF, so it should take the AVIF thumbs the <picture>
// offers, and the script-made preloads should ask for those same files:
// no card picture downloaded in both formats.
const cardArt = (url) => {
  const m = new URL(url).pathname.match(/^\/cards\/(?:(thumbs|mid)\/)?([A-Za-z0-9-]+)\.(webp|avif)$/);
  return m ? { size: { thumbs: 'thumb', mid: 'mid' }[m[1]] || 'full', id: m[2], format: m[3] } : null;
};

test('the collection takes AVIF thumbs and fetches each picture once', async ({ page }) => {
  const asked = [];
  page.on('request', (r) => { const art = cardArt(r.url()); if (art) asked.push(art); });
  await bootToMainMenu(page);
  await page.getByRole('button', { name: 'Collection', exact: true }).click();
  await expect(page.getByRole('button', { name: /^View / }).first()).toBeVisible(SLOW);
  await settled(page);
  const thumbs = asked.filter((a) => a.size === 'thumb');
  expect(thumbs.length).toBeGreaterThan(0);
  expect(thumbs.filter((a) => a.format !== 'avif')).toEqual([]);
  const twice = thumbs.map((a) => a.id).filter((id, i, all) => all.indexOf(id) !== i);
  expect(twice).toEqual([]);
});

test.describe('on a 3x phone', () => {
  test.use({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });

  test('the menu fan draws the 480px mid art, not the 768px originals', async ({ page }) => {
    const asked = [];
    page.on('request', (r) => { const art = cardArt(r.url()); if (art) asked.push(art); });
    await bootToMainMenu(page);
    await expect.poll(() => page.evaluate(() => [...document.querySelectorAll('[data-art] img')]
      .filter((img) => img.currentSrc.includes('/cards/mid/') && img.complete && img.naturalWidth > 0).length), SLOW).toBeGreaterThan(0);
    expect(asked.filter((a) => a.size === 'full')).toEqual([]);
    expect(asked.filter((a) => a.size === 'mid').every((a) => a.format === 'avif')).toBe(true);
  });
});
