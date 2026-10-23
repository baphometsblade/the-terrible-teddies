import { test, expect, bootToMainMenu, SLOW } from './helpers/session.js';
import { getDailyChallenges } from '../src/stores/challenges.js';

// The progression and information screens around the menu: the tutorial,
// Challenges, the leaderboard, Daily Rewards and Player Stats.

// Writes over the seeded save and reloads with it. An init script, because
// the boot's own seed is one and re-runs on every navigation: registered
// after it, this runs after it too, so its fields win.
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

// The boxes of the visible controls in `dialog` that `box` overlaps.
const controlsUnder = async (dialog, box) => {
  const hits = [];
  for (const control of await dialog.locator('button, [tabindex="0"]').all()) {
    if (!(await control.isVisible())) continue;
    const r = await control.boundingBox();
    const ox = Math.min(r.x + r.width, box.x + box.width) - Math.max(r.x, box.x);
    const oy = Math.min(r.y + r.height, box.y + box.height) - Math.max(r.y, box.y);
    if (ox > 0 && oy > 0) hits.push((await control.getAttribute('aria-label')) || (await control.textContent()));
  }
  return hits;
};

test.describe('challenge claims', () => {
  // A claim pays out on the card (a rising "+100" and the words in the
  // dialog's status region) instead of in a toast, which landed on the
  // dialog's Close on a phone and on the bonus Claim on a desktop. A toast that
  // still arrives over a dialog (here the level-up the claimed XP causes) goes
  // to the top-left corner, clear of every control, and lets taps through.
  for (const viewport of [{ width: 390, height: 844 }, { width: 1280, height: 800 }, { width: 320, height: 640 }]) {
    test(`a claim pays out in place, and the toast that follows keeps off the controls at ${viewport.width}`, async ({ page }) => {
      // A day whose four include the one XP challenge ("Play 5 Games") and no
      // other game-count challenge, as board.spec.js picks it.
      const day = [...Array(60).keys()]
        .map((i) => new Date(Date.UTC(2027, 0, 1 + i, 12)))
        .find((d) => {
          const ids = getDailyChallenges(d).map((c) => c.id);
          return ids.includes('d5') && !ids.includes('d4') && !ids.includes('d6');
        });
      await page.clock.setFixedTime(day);
      await page.setViewportSize(viewport);
      await bootToMainMenu(page);
      await seed(page, {
        level: 1, xp: 0, todayBattles: 5, dailyStatsDate: day.toDateString(), claimedChallenges: [],
      });
      await page.getByRole('button', { name: 'Challenges', exact: true }).click();
      const dialog = page.getByRole('dialog', { name: 'Challenges' });
      await expect(dialog).toBeVisible(SLOW);
      await dialog.getByRole('button', { name: 'Claim', exact: true }).click();

      await expect(dialog.getByRole('status')).toHaveText('Play 5 Games claimed: 100 XP.');
      await expect(dialog.locator('[data-claim-float]')).toHaveText('+100');
      // The float is decoration, and it goes.
      await expect(dialog.locator('[data-claim-float]')).toHaveCount(0, { timeout: 3000 });

      const toast = page.locator('.toast-viewport > li').filter({ hasText: 'Level 2!' });
      await expect(toast).toBeVisible(SLOW);
      // The only toast: the claim no longer raises one of its own.
      await expect(page.locator('.toast-viewport > li')).toHaveCount(1);
      await expect(toast).toHaveCSS('pointer-events', 'none');
      expect(await controlsUnder(dialog, await toast.boundingBox()), 'the toast covers dialog controls').toEqual([]);
      // Close works while it is up.
      await dialog.getByRole('button', { name: 'Close challenges' }).click();
      await expect(dialog).toHaveCount(0);
    });
  }
});
