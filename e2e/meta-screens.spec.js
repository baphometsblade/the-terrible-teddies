import { test, expect, bootToMainMenu, SLOW } from './helpers/session.js';

// The progression and information screens around the menu: the tutorial,
// Challenges, the leaderboard, Daily Rewards and Player Stats.

// Writes over the seeded save (after the boot) and reloads with it.
const seed = async (page, patch) => {
  await page.evaluate((p) => {
    const raw = localStorage.getItem('terrible-teddies-storage');
    const stored = raw ? JSON.parse(raw) : { state: {}, version: 3 };
    Object.assign(stored.state, p);
    localStorage.setItem('terrible-teddies-storage', JSON.stringify(stored));
  }, patch);
  await page.reload();
  await expect(page.getByRole('button', { name: 'Battle', exact: true })).toBeVisible(SLOW);
};

test.describe('tutorial', () => {
  // A pager's controls stay under the thumb. The panel used to take each
  // step's natural height and re-centre, so Next moved by up to 190px from one
  // step to the next on a phone, and tapping through landed on the scrim.
  for (const viewport of [{ width: 390, height: 844 }, { width: 1280, height: 800 }, { width: 320, height: 640 }]) {
    test(`Previous and Next hold still from step to step at ${viewport.width}x${viewport.height}`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await bootToMainMenu(page);
      await page.getByRole('button', { name: 'How to play' }).click();
      const dialog = page.getByRole('dialog', { name: 'How to play' });
      await expect(dialog).toBeVisible(SLOW);
      const tops = new Set();
      for (let step = 1; step <= 9; step += 1) {
        await expect(dialog.getByText(`Step ${step} of 9`)).toBeVisible();
        const nav = dialog.getByRole('button', { name: step === 9 ? 'Start Playing!' : 'Next' });
        const box = await nav.boundingBox();
        tops.add(Math.round(box.y));
        // Every step can still be read to its end: a long one scrolls.
        const body = dialog.getByRole('region');
        const fits = await body.evaluate((el) => {
          el.scrollTop = el.scrollHeight;
          const last = el.firstElementChild.getBoundingClientRect();
          return last.bottom <= el.getBoundingClientRect().bottom + 1;
        });
        expect(fits, `step ${step} cannot be scrolled to its end`).toBe(true);
        if (step < 9) await nav.click();
      }
      expect([...tops], 'Next moved between steps').toHaveLength(1);
    });
  }
});
