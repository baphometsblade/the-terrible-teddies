import { test, expect, bootToMainMenu, SLOW } from './helpers/session.js';

test.beforeEach(async ({ page }) => {
  await bootToMainMenu(page);
});

test('the turn slip is on the board, and a swing says what it will do', async ({ page }) => {
  await page.addInitScript(() => {
    const raw = localStorage.getItem('terrible-teddies-storage');
    const stored = raw ? JSON.parse(raw) : { state: {}, version: 3 };
    stored.state.currentDeck = [1, 2, 3, 4, 5, 6];
    localStorage.setItem('terrible-teddies-storage', JSON.stringify(stored));
  });
  await page.reload();
  await page.getByRole('button', { name: 'Battle', exact: true }).click();

  const slip = page.locator('[data-turn-slip]');
  await expect(slip).toBeVisible(SLOW);
  await expect(slip).toContainText('Your round');

  await page.getByRole('button', { name: /^Play / }).first().click();
  await expect(slip).toContainText('played 1');

  const endTurn = page.getByRole('button', { name: 'End Turn' });
  await endTurn.click();
  await expect(page.locator('[role="log"]')).toContainText(/Your round: played/);
  await expect(page.getByText(/Turn 2/)).toBeVisible(SLOW);

  await page.getByRole('button', { name: /^Select .+ to attack$/ }).first().click();
  const preview = page.locator('[data-strike-preview]');
  await expect(preview).toBeVisible();
  await expect(preview).toContainText(/Pick a victim/);
  await expect(preview).toContainText(/dmg|Chuck|trap|creatures/i);
});

test('a Quickie can be sent the turn it sits down', async ({ page }) => {
  await page.addInitScript(() => {
    const raw = localStorage.getItem('terrible-teddies-storage');
    const stored = raw ? JSON.parse(raw) : { state: {}, version: 3 };
    stored.state.currentDeck = [96, 96, 96, 96, 96, 96];
    stored.state.firstFightSeen = true;
    localStorage.setItem('terrible-teddies-storage', JSON.stringify(stored));
  });
  await page.reload();
  await page.getByRole('button', { name: 'Battle', exact: true }).click();
  await expect(page.getByRole('button', { name: 'End Turn' })).toBeVisible(SLOW);
  await page.getByRole('button', { name: 'Play Quickie Quinn' }).first().click();
  const swing = page.getByRole('button', { name: 'Select Quickie Quinn to attack' });
  await expect(swing).toBeVisible();
  await swing.click();
  await expect(page.locator('[data-strike-preview]')).toContainText(/dmg|creatures/);
});

test('a killing shake does not run when the player asks for less motion', async ({ page }) => {
  await page.getByRole('button', { name: 'Battle', exact: true }).click();
  await expect(page.getByRole('button', { name: 'End Turn' })).toBeVisible(SLOW);
  const felt = page.locator('.felt-table');
  await felt.evaluate((el) => { el.dataset.shake = 'lg'; });
  await expect.poll(() => felt.evaluate((el) => getComputedStyle(el).animationName)).toBe('none');

  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.evaluate(() => { document.documentElement.dataset.motion = 'on'; });
  await expect.poll(() => felt.evaluate((el) => getComputedStyle(el).animationName)).toBe('board-shake-lg');
});
