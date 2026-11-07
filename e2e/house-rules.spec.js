import { test, expect, bootToMainMenu, SLOW } from './helpers/session.js';

test('open bar pours one extra energy on the first turn', async ({ page }) => {
  await bootToMainMenu(page);
  await page.getByRole('button', { name: 'Settings' }).click();
  const dialog = page.getByRole('dialog', { name: 'Settings' });
  await expect(dialog.getByRole('button', { name: /Open bar/ })).toBeVisible();
  await dialog.getByRole('button', { name: /Open bar/ }).click();
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Battle', exact: true }).click();
  await expect(page.locator('[data-energy]')).toHaveText('4/4', SLOW);
  await expect(page.locator('[role="log"]')).toContainText(/energy/);
});

test('a quiet concede still names the MVP, which is nobody', async ({ page }) => {
  await bootToMainMenu(page);
  await page.getByRole('button', { name: 'Battle', exact: true }).click();
  await expect(page.getByRole('button', { name: 'End Turn' })).toBeVisible(SLOW);
  await page.getByRole('button', { name: 'Concede' }).click();
  await page.getByRole('button', { name: 'Concede — counts as a loss' }).click();
  await expect(page.locator('[data-mvp]')).toContainText('Hands stayed polite');
});
