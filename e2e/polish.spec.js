import { test, expect, bootToMainMenu, SLOW } from './helpers/session.js';

// Writes over the seeded save and reloads. Registered after the boot seed, so
// its fields win (see e2e/meta-screens.spec.js).
const seed = async (page, patch) => {
  await page.addInitScript((p) => {
    const raw = localStorage.getItem('terrible-teddies-storage');
    const stored = raw ? JSON.parse(raw) : { state: {}, version: 5 };
    Object.assign(stored.state, p);
    localStorage.setItem('terrible-teddies-storage', JSON.stringify(stored));
  }, patch);
  await page.reload();
};

test('a new player can sit down and fight from the first tutorial step', async ({ page }) => {
  await bootToMainMenu(page);
  await seed(page, { tutorialCompleted: false, lastLoginDate: new Date().toDateString() });
  const tutorial = page.getByRole('dialog', { name: 'How to play' });
  await expect(tutorial).toBeVisible(SLOW);
  await expect(tutorial.getByText('Step 1 of 9')).toBeVisible();
  await tutorial.getByRole('button', { name: /Sit on Chuck's lap/ }).click();
  await expect(page.getByRole('button', { name: 'End Turn' })).toBeVisible(SLOW);
  await expect(page.getByRole('dialog', { name: 'How to play' })).toHaveCount(0);
});

test('a coin card back equips, shows on the table, and is still on after a reload', async ({ page }) => {
  await bootToMainMenu(page);
  await page.getByRole('button', { name: 'Wardrobe', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Wardrobe' });
  await dialog.getByRole('button', { name: 'Buy Velvet Rope card back' }).click();
  await expect(dialog.getByRole('button', { name: 'Velvet Rope, wearing' })).toBeVisible();
  await expect(dialog.getByText("Velvet Rope is what you're wearing.")).toBeVisible();
  await dialog.getByRole('button', { name: 'Buy Firm Hand card back' }).click();
  await expect(dialog.getByRole('button', { name: 'Spend 30 gems' })).toBeVisible();
  await dialog.getByRole('button', { name: 'Keep them' }).click();
  await expect(dialog.getByRole('button', { name: 'Spend 30 gems' })).toHaveCount(0);
  await page.keyboard.press('Escape');

  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('terrible-teddies-storage')).state);
  expect(saved.equippedCardBack).toBe('velvet-rope');
  expect(saved.unlockedCosmetics).toContain('velvet-rope');
  expect(saved.unlockedCosmetics).not.toContain('brass-knuckles');

  await page.getByRole('button', { name: 'Battle', exact: true }).click();
  await expect(page.getByRole('button', { name: 'End Turn' })).toBeVisible(SLOW);
  await expect(page.locator('[data-card-back="velvet-rope"]').first()).toBeVisible();
});

test('mute, text size and colour-safe rarities persist on this device', async ({ page }) => {
  await bootToMainMenu(page);
  await page.getByRole('button', { name: 'Settings' }).click();
  const dialog = page.getByRole('dialog', { name: 'Settings' });
  await dialog.getByRole('switch', { name: 'Mute' }).click();
  await dialog.getByRole('button', { name: 'Larger', exact: true }).click();
  await dialog.getByRole('switch', { name: 'Colour-safe rarities' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-text', 'larger');
  await expect(page.locator('html')).toHaveAttribute('data-cb', 'safe');
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('terrible-teddies-storage')).state);
  expect(saved).toMatchObject({ audioMuted: true, textSize: 'larger', colorblindSafe: true });
  await page.keyboard.press('Escape');
});
