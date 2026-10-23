import { test, expect, bootToMainMenu, SLOW } from './helpers/session.js';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
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

test.describe('daily rewards', () => {
  // The reward is collected by a tap. It used to be granted the moment the
  // panel mounted, so there was nothing to press, and the card it drew was
  // never shown. A player who closes without claiming keeps the reward, and
  // the menu keeps saying so.
  test('waits for Claim, shows the card it drew, and reopens on the countdown', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await bootToMainMenu(page);
    const yesterday = await page.evaluate(() => { const d = new Date(); d.setDate(d.getDate() - 1); return d.toDateString(); });
    await page.addInitScript((y) => {
      const stored = JSON.parse(localStorage.getItem('terrible-teddies-storage'));
      // Yesterday's claim on record: today is day 2, a card day.
      Object.assign(stored.state, { lastLoginDate: y, consecutiveLogins: 1, ownedCards: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] });
      localStorage.setItem('terrible-teddies-storage', JSON.stringify(stored));
    }, yesterday);
    await page.reload();

    // First launch of the day: the panel opens itself, and waits.
    const dialog = page.getByRole('dialog', { name: 'Daily Rewards' });
    await expect(dialog).toBeVisible(SLOW);
    await expect(dialog.getByRole('button', { name: 'Claim', exact: true })).toBeFocused();
    await expect(dialog.locator('[data-day="2"]')).toHaveAttribute('data-look', 'today');
    const coins = async () => page.evaluate(() => JSON.parse(localStorage.getItem('terrible-teddies-storage')).state.coins);
    const before = await coins();

    // Closed unclaimed: nothing granted, and the menu still offers it.
    await dialog.getByRole('button', { name: 'Close daily rewards' }).click();
    await expect(dialog).toHaveCount(0);
    expect(await coins()).toBe(before);
    const menuButton = page.getByRole('button', { name: 'Daily rewards — a reward is ready to claim' });
    await expect(menuButton).toBeVisible();

    await menuButton.click();
    await dialog.getByRole('button', { name: 'Claim', exact: true }).click();
    await expect(dialog.locator('[data-day="2"]')).toHaveAttribute('data-look', 'stamped');
    await expect(dialog.locator('[data-stamp]')).toBeVisible();
    await expect(dialog.getByRole('status')).toContainText(/^Day 2 claimed: 75 coins and 1 card\. New card: .+ \((Common|Uncommon|Rare|Epic|Legendary)\)\.$/);
    // The card it drew is on the table, and it is one the player did not own.
    const card = dialog.locator('[data-granted-card]');
    await expect(card).toHaveCount(1);
    expect(Number(await card.getAttribute('data-granted-card'))).toBeGreaterThan(10);
    await expect(card.locator('[data-reveal-card="up"]')).toBeVisible(SLOW);
    expect(await coins()).toBe(before + 75);

    const go = dialog.getByRole('button', { name: 'Continue' });
    await expect(go).toBeFocused();
    await expect(go).toBeInViewport();
    await go.click();
    await expect(dialog).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Daily rewards', exact: true })).toBeVisible();

    // Reopened: today stamped, tomorrow marked, and when the next one comes.
    await page.getByRole('button', { name: 'Daily rewards', exact: true }).click();
    await expect(dialog.locator('[data-day="2"]')).toHaveAttribute('data-look', 'stamped');
    await expect(dialog.locator('[data-day="3"]')).toHaveAttribute('data-look', 'tomorrow');
    await expect(dialog).toContainText(/Next reward in \d+h \d+m/);
    await expect(dialog.getByRole('button', { name: 'Claim', exact: true })).toHaveCount(0);
  });

  // The reopened panel marks the next day. Its chip said "Tomorrow", which
  // ran 5px past both sides of a day's tile at 320 and 3px at 640, where the
  // row goes eight across. Day 2 claimed puts it on the narrow Day 3.
  for (const viewport of [{ width: 320, height: 640 }, { width: 640, height: 800 }]) {
    test(`every day's contents stay inside its tile, reopened, at ${viewport.width}`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await bootToMainMenu(page);
      await seed(page, { consecutiveLogins: 2 });
      await page.getByRole('button', { name: 'Daily rewards', exact: true }).click();
      const dialog = page.getByRole('dialog', { name: 'Daily Rewards' });
      await expect(dialog.locator('[data-day="3"]')).toHaveAttribute('data-look', 'tomorrow', SLOW);
      const spills = await dialog.locator('[data-day]').evaluateAll((tiles) => tiles.flatMap((tile) => {
        const t = tile.getBoundingClientRect();
        return [...tile.querySelectorAll('*')]
          .filter((el) => {
            const r = el.getBoundingClientRect();
            return r.width > 1 && (r.left < t.left - 0.5 || r.right > t.right + 0.5);
          })
          .map((el) => `day ${tile.dataset.day}: "${el.textContent.trim()}"`);
      }));
      expect(spills).toEqual([]);
    });
  }

  // Once a reward could be left unclaimed, App's auto-open fired again on
  // every new session object, and supabase-js makes one each time the tab
  // comes back into view (and on every token refresh): the panel landed on
  // top of a battle in progress. It opens by itself once a day, and after
  // that the menu's glow carries the reward.
  test('opens by itself once: a tab return does not bring it back over a battle', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await bootToMainMenu(page);
    const yesterday = await page.evaluate(() => { const d = new Date(); d.setDate(d.getDate() - 1); return d.toDateString(); });
    await page.addInitScript((y) => {
      const stored = JSON.parse(localStorage.getItem('terrible-teddies-storage'));
      Object.assign(stored.state, { lastLoginDate: y, consecutiveLogins: 1 });
      localStorage.setItem('terrible-teddies-storage', JSON.stringify(stored));
    }, yesterday);
    await page.reload();
    const dialog = page.getByRole('dialog', { name: 'Daily Rewards' });
    await expect(dialog).toBeVisible(SLOW);
    await dialog.getByRole('button', { name: 'Close daily rewards' }).click();
    await expect(dialog).toHaveCount(0);

    await page.getByRole('button', { name: 'Battle', exact: true }).click();
    await expect(page.locator('html')).toHaveAttribute('data-screen', 'battle', SLOW);
    // The tab comes back into view. supabase-js listens on document.
    await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange', { bubbles: true })));
    // The auto-open waits 500ms after the session lands; give it well past that.
    await page.waitForTimeout(2000);
    await expect(dialog).toHaveCount(0);
    await expect(page.locator('html')).toHaveAttribute('data-screen', 'battle');
  });
});

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

// The achievement with the longest toast line. The toast itself is built in
// the page by App's own achievementToast (its badge on a medallion, the
// reward with a coin icon), so this measures what a player sees. It used to
// rebuild App's wording here, emoji and all.
const LONGEST_ACHIEVEMENT = (() => {
  const src = readFileSync(resolve(process.cwd(), 'src/stores/gameStore.js'), 'utf8');
  const table = src.slice(src.indexOf('export const ACHIEVEMENTS = ['));
  return [...table.slice(0, table.indexOf('];')).matchAll(/name: '([^']+)'.*?reward: (\d+), icon: '([^']+)'/g)]
    .map(([, name, reward, icon]) => ({ name, reward: Number(reward), icon }))
    .sort((a, b) => `${b.name}${b.reward.toLocaleString('en-US')}`.length - `${a.name}${a.reward.toLocaleString('en-US')}`.length)[0];
})();

test.describe('a toast over a dialog', () => {
  // The tutorial's step bar is the highest control under any dialog's
  // header, 77px down at 320. The longest achievement toast takes three
  // lines there and reached 9px into it; set tighter, it ends above it.
  // The toast is raised through the app's own toast module, which only the
  // dev server serves at its source path.
  test.skip(!!process.env.E2E_PREVIEW, 'imports the toast module from /src');
  for (const viewport of [{ width: 320, height: 568 }, { width: 390, height: 844 }]) {
    test(`the longest achievement toast clears the tutorial's controls at ${viewport.width}`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await bootToMainMenu(page);
      await page.getByRole('button', { name: 'How to play' }).click();
      const dialog = page.getByRole('dialog', { name: 'How to play' });
      await expect(dialog.getByText('Step 1 of 9')).toBeVisible(SLOW);
      await page.evaluate(async (a) => {
        const { toast } = await import('/src/components/ui/use-toast.js');
        const { achievementToast } = await import('/src/lib/achievementToast.jsx');
        toast({ ...achievementToast(a), duration: 60000 });
      }, LONGEST_ACHIEVEMENT);
      const toast = page.locator('.toast-viewport > li').filter({ hasText: 'Achievement Unlocked!' });
      await expect(toast).toBeVisible();
      expect(await controlsUnder(dialog, await toast.boundingBox()), 'the toast covers dialog controls').toEqual([]);
    });
  }
});

// Every achievement id, read from the store's table so a new one is counted.
const ACHIEVEMENT_IDS = (() => {
  const src = readFileSync(resolve(process.cwd(), 'src/stores/gameStore.js'), 'utf8');
  const table = src.slice(src.indexOf('export const ACHIEVEMENTS = ['));
  return [...table.slice(0, table.indexOf('];')).matchAll(/id: '([^']+)'/g)].map((m) => m[1]);
})();

test.describe('player stats', () => {
  // "Achievements (0/16)" wrapped to two lines at 390 (and below), so its tab
  // stood taller than Statistics and off-centre. Each tab is one line now,
  // the count in the pill Challenges' tabs use. A two-digit count ("10/16")
  // at 320 then needed a pixel more than the switch had, and the pill sat on
  // its rim, so the full count is checked against the well too.
  for (const width of [320, 390]) {
    for (const done of [0, ACHIEVEMENT_IDS.length]) {
      test(`each tab is one line, the same height as the other, inside the switch, at ${width} with ${done} unlocked`, async ({ page }) => {
        await page.setViewportSize({ width, height: 800 });
        await bootToMainMenu(page);
        if (done) await seed(page, { completedAchievements: ACHIEVEMENT_IDS.slice(0, done) });
        await page.getByLabel('View player stats').click();
        const dialog = page.getByRole('dialog', { name: 'Player stats' });
        await expect(dialog).toBeVisible(SLOW);
        const achievements = dialog.getByRole('button', { name: new RegExp(`^Achievements\\s*\\(${done} of \\d+ unlocked\\)$`) });
        await expect(achievements).toBeVisible();
        const tabs = await dialog.locator('[data-tab]').evaluateAll((els) => els.map((b) => {
          const lines = new Set([...b.children]
            .filter((c) => c.getBoundingClientRect().width > 1)
            .map((c) => { const r = c.getBoundingClientRect(); return Math.round(r.top + r.height / 2); }));
          return { height: Math.round(b.getBoundingClientRect().height), lines: lines.size, overflows: b.scrollWidth > b.clientWidth };
        }));
        expect(tabs).toHaveLength(2);
        expect(tabs.map((t) => t.lines), 'a tab wrapped onto a second line').toEqual([1, 1]);
        expect(tabs[0].height).toBe(tabs[1].height);
        expect(tabs.some((t) => t.overflows), 'a tab runs out of its segment').toBe(false);
        // The well's content box holds both tabs: its padding is the rim.
        const fit = await dialog.locator('[data-tab]').first().evaluate((tab) => {
          const well = tab.parentElement;
          const w = well.getBoundingClientRect();
          const pad = parseFloat(getComputedStyle(well).paddingRight);
          const last = well.lastElementChild.getBoundingClientRect();
          return { lastRight: last.right, contentRight: w.right - pad, scrolls: well.scrollWidth > well.clientWidth };
        });
        expect(fit.lastRight, 'a tab runs onto the switch\'s rim').toBeLessThanOrEqual(fit.contentRight + 0.5);
        expect(fit.scrolls).toBe(false);
        await expect(achievements.locator('[data-count]')).toHaveCSS('border-radius', /px/);
      });
    }
  }
});
