import { test, expect, bootToMainMenu, SLOW } from './helpers/session.js';

// The retention surfaces: a quest reroll, the collection book, and wearing a
// title. Each is exercised, not just rendered.

const seed = async (page, patch) => {
  await page.addInitScript((p) => {
    const raw = localStorage.getItem('terrible-teddies-storage');
    const stored = raw ? JSON.parse(raw) : { state: {}, version: 5 };
    Object.assign(stored.state, p);
    localStorage.setItem('terrible-teddies-storage', JSON.stringify(stored));
  }, patch);
  await page.reload();
  await expect(page.getByRole('button', { name: 'Battle', exact: true })).toBeVisible(SLOW);
};

test('a quest reroll swaps one challenge and is then spent', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await bootToMainMenu(page);
  await page.getByRole('button', { name: 'Challenges', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Challenges' });
  await expect(dialog).toBeVisible(SLOW);
  await expect(dialog.getByText('One reroll. Dump a quest you don’t fancy.')).toBeVisible();
  const before = await dialog.locator('h3').allTextContents();
  await dialog.getByRole('button', { name: /^Reroll / }).first().click();
  await expect(dialog.getByText('Tonight’s reroll already went home.')).toBeVisible();
  await expect(dialog.getByRole('button', { name: /^Reroll / })).toHaveCount(0);
  await expect(dialog.getByRole('button', { name: 'Buy reroll' })).toBeVisible();
  const after = await dialog.locator('h3').allTextContents();
  expect(after).not.toEqual(before);
});

test('the collection book lists a set, its missing cards, and returns to the album', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await bootToMainMenu(page);
  await page.getByRole('button', { name: 'Collection', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Card Collection' })).toBeVisible(SLOW);
  const book = page.getByRole('button', { name: 'The notches', exact: true });
  const box = await book.boundingBox();
  expect(box.height).toBeGreaterThanOrEqual(44);
  expect(box.width).toBeGreaterThanOrEqual(44);
  await book.click();
  await expect(page.getByRole('heading', { name: 'The Easy Yes' })).toBeVisible();
  await expect(page.getByText('They said yes before the drinks landed.')).toBeVisible();
  await page.getByRole('button', { name: /^Haven’t had, / }).first().click();
  await expect(page.getByRole('listitem').first()).toBeVisible();
  await page.getByRole('button', { name: 'Back to the cards', exact: true }).click();
  await expect(page.getByRole('button', { name: /^View / }).first()).toBeVisible();
});

test('wearing an earned title shows it on the menu', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await bootToMainMenu(page);
  await seed(page, { completedAchievements: ['first_win'] });
  await page.getByLabel('View player stats').click();
  const dialog = page.getByRole('dialog', { name: 'Player stats' });
  await expect(dialog).toBeVisible(SLOW);
  await dialog.locator('[data-tab="achievements"]').click();
  const wear = dialog.getByRole('button', { name: 'Wear Lucky Bastard', exact: true });
  await expect(wear).toBeVisible();
  const wearBox = await wear.boundingBox();
  expect(wearBox.height).toBeGreaterThanOrEqual(44);
  await wear.click();
  await expect(dialog.getByRole('button', { name: 'Wearing Lucky Bastard', exact: true })).toBeVisible();
  await dialog.getByRole('button', { name: 'Close stats' }).click();
  await expect(page.getByText('Lucky Bastard', { exact: true })).toBeVisible();
});
