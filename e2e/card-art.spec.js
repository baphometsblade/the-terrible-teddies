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

  await page.getByRole('button', { name: /^Missing\b/ }).click();
  await settled(page);
  const frames = await page.locator('[data-art] [data-art-frame]:visible').count();
  expect(frames).toBeGreaterThan(0);
});
