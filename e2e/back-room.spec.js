import { test, expect, bootToMainMenu, SLOW } from './helpers/session.js';

const seed = async (page, patch) => {
  await page.addInitScript((p) => {
    const raw = localStorage.getItem('terrible-teddies-storage');
    const stored = raw ? JSON.parse(raw) : { state: {}, version: 7 };
    Object.assign(stored.state, p);
    localStorage.setItem('terrible-teddies-storage', JSON.stringify(stored));
  }, patch);
  await page.reload();
  await expect(page.getByRole('button', { name: 'Battle', exact: true })).toBeVisible(SLOW);
};

test('the back room opens from the rap sheet and keeps its sections on a phone', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await bootToMainMenu(page);
  await page.getByLabel('View player stats').click();
  const stats = page.getByRole('dialog', { name: 'Player stats' });
  await expect(stats).toBeVisible(SLOW);
  const door = stats.getByRole('button', { name: 'The back room', exact: true });
  const box = await door.boundingBox();
  expect(box.height).toBeGreaterThanOrEqual(44);
  expect(box.width).toBeGreaterThanOrEqual(44);
  await door.click();
  const room = page.getByRole('dialog', { name: 'The back room' });
  await expect(room).toBeVisible();
  await expect(room.getByRole('heading', { name: 'The First Round' })).toBeVisible();
  await expect(room.getByRole('heading', { name: 'The house tab' })).toBeVisible();
  await expect(room.getByRole('heading', { name: 'Bar crawl' })).toBeVisible();
  const overflow = await room.evaluate((dialog) => dialog.scrollWidth > dialog.clientWidth + 1);
  expect(overflow).toBe(false);
});

test('saying you are in arms the night, and a level on the tab pays out', async ({ page }) => {
  // Wednesday 4 Nov 2026, 18:30 local: happy hour, and no special day.
  await page.clock.install({ time: new Date(2026, 10, 4, 18, 30) });
  await page.setViewportSize({ width: 390, height: 844 });
  await bootToMainMenu(page);
  const today = await page.evaluate(() => new Date().toDateString());
  await seed(page, { level: 2, coins: 10, claimedLevelRewards: [], lastLoginDate: today });
  await page.getByLabel('View player stats').click();
  await page.getByRole('dialog', { name: 'Player stats' }).getByRole('button', { name: 'The back room', exact: true }).click();
  const room = page.getByRole('dialog', { name: 'The back room' });
  await expect(room.getByRole('heading', { name: 'Happy Hour' })).toBeVisible();
  const before = await page.evaluate(() => JSON.parse(localStorage.getItem('terrible-teddies-storage')).state.coins);
  await room.getByRole('button', { name: 'I’m in', exact: true }).click();
  await expect(room.getByRole('button', { name: 'You are in', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await room.getByRole('button', { name: 'Take level 2', exact: true }).click();
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('terrible-teddies-storage')).state.coins)).toBe(before + 40);
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('terrible-teddies-storage')).state.eventArmed)).toBe('happy_hour');
  await page.keyboard.press('Escape');
  await expect(room).toHaveCount(0);
  await expect(page.getByRole('dialog', { name: 'Player stats' })).toBeVisible();
});

test('hair of the dog pays the morning after a fight', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await bootToMainMenu(page);
  const yesterday = await page.evaluate(() => {
    const date = new Date();
    date.setDate(date.getDate() - 1);
    return date.toDateString();
  });
  await seed(page, { lastBattleDate: yesterday, morningAfterDate: null, coins: 100 });
  await page.getByRole('button', { name: /^Daily rewards/ }).click();
  const dialog = page.getByRole('dialog', { name: 'Daily Rewards' });
  await expect(dialog).toBeVisible(SLOW);
  await dialog.getByRole('button', { name: 'Hair of the dog', exact: true }).click();
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('terrible-teddies-storage')).state.coins)).toBe(140);
});
