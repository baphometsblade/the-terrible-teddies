// The paths where real money meets the save: what Reset All Progress keeps,
// the one-per-account Starter offer, and the purchase-return screen while a
// payment is still unconfirmed, refunded, or confirms late.
import { test, expect, bootToMainMenu, SLOW } from './helpers/session.js';
import { getCurrentSeason } from '../src/utils/season.js';

const season = getCurrentSeason();
const STORAGE_KEY = 'terrible-teddies-storage';

test.beforeEach(async ({ page }) => {
  await bootToMainMenu(page);
});

// Patch the seeded save and reload into it (the boot's own seed runs first).
async function seed(page, patch) {
  await page.addInitScript(([key, p]) => {
    const raw = localStorage.getItem(key);
    const stored = raw ? JSON.parse(raw) : { state: {}, version: 3 };
    Object.assign(stored.state, p);
    localStorage.setItem(key, JSON.stringify(stored));
  }, [STORAGE_KEY, patch]);
  await page.reload();
  await expect(page.getByRole('button', { name: 'Battle', exact: true })).toBeVisible(SLOW);
}

const saved = (page) => page.evaluate((key) => JSON.parse(localStorage.getItem(key)).state, STORAGE_KEY);

test('Reset All Progress says what it keeps, in numbers, and keeps it', async ({ page }) => {
  // A buyer: 3,000 gems bought (the mark says so), this season's Premium Pass
  // and two unopened Premium packs, on top of ordinary progress.
  await seed(page, {
    gems: 3000, lastSyncedServerGems: 3000, seasonKey: season.key, hasBattlePassPremium: true,
    premiumPacks: 2, coins: 2345, level: 7,
  });

  await page.getByRole('button', { name: 'Settings' }).click();
  const dialog = page.getByRole('dialog', { name: 'Settings' });
  await expect(dialog).toBeVisible(SLOW);
  await dialog.getByRole('button', { name: 'Reset All Progress' }).click();

  const kept = dialog.getByRole('region', { name: 'Kept' });
  await expect(kept.getByText('3,000 gems', { exact: true })).toBeVisible();
  await expect(kept.getByText(`Premium Pass for ${season.name}`)).toBeVisible();
  await expect(kept.getByText('2 Premium packs, unopened')).toBeVisible();
  const deleted = dialog.getByRole('region', { name: 'Deleted' });
  await expect(deleted).toContainText('Level 7');
  await expect(deleted).toContainText('2,345 coins');

  await dialog.getByRole('textbox', { name: 'Type RESET to confirm the reset' }).fill('RESET');
  await dialog.getByRole('button', { name: 'Confirm Reset' }).click();
  await expect(dialog).toHaveCount(0, SLOW);

  await expect.poll(async () => {
    const s = await saved(page);
    return [s.gems, s.hasBattlePassPremium, s.premiumPacks, s.coins, s.level, s.lastSyncedServerGems];
  }).toEqual([3000, true, 2, 500, 1, 3000]);
});
