import { test, expect, stubSupabase, seedSignedIn, SLOW } from './helpers/session.js';

const standing = {
  ok: true,
  username: 'QA Bear',
  rating: 1100,
  peak_rating: 1100,
  tier: 'Getting Handsy',
  wins: 4,
  losses: 1,
  week_wins: 2,
  week_losses: 1,
  week_delta: 20,
  season_id: '2026-W45',
  day_room: 60,
  code: 'abcdef1234',
  label: 'Saved deck',
  open_match: null,
};

const week = [
  {
    place: 1, username: 'QA Bear', rating: 1100, tier: 'Barfly',
    week_wins: 2, week_losses: 1, week_delta: 20, code: 'abcdef1234', is_me: true,
  },
  {
    place: 2, username: 'DreadBear', rating: 1050, tier: 'Barfly',
    week_wins: 1, week_losses: 2, week_delta: -8, code: 'bbbbbbbbbb', is_me: false,
  },
];

test.describe('house ladder', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test.beforeEach(async ({ page }) => {
    await stubSupabase(page);
    await page.route('**/rest/v1/rpc/my_social', (route) => route.fulfill({ json: standing }));
    await page.route('**/rest/v1/rpc/weekly_board', (route) => route.fulfill({ json: week }));
    await page.route('**/rest/v1/rpc/public_card', (route) => route.fulfill({
      json: [{
        username: 'DreadBear', tier: 'Barfly', rating: 1050, peak_rating: 1100,
        wins: 3, losses: 2, week_wins: 1, week_losses: 2, week_delta: -8,
        label: 'Saved deck', is_me: false,
      }],
    }));
    await seedSignedIn(page);
    await page.goto('/');
    await expect(page.getByRole('button', { name: 'Battle', exact: true })).toBeVisible(SLOW);
  });

  test('opens from the rankings, shows the week, and stays on the screen', async ({ page }) => {
    await page.getByRole('button', { name: 'Rankings', exact: true }).click();
    await page.getByRole('button', { name: 'The ladder', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'The ladder' });
    await expect(dialog).toBeVisible(SLOW);
    await expect(dialog.getByText('Getting Handsy', { exact: true }).first()).toBeVisible();
    await expect(dialog.getByText(/leaned in/)).toBeVisible();
    await dialog.getByRole('tab', { name: 'This week' }).click();
    await dialog.getByRole('button', { name: /DreadBear/ }).click();
    await expect(dialog.getByRole('button', { name: 'Have a go' })).toBeVisible();
    const overflow = await page.evaluate(() => (
      document.documentElement.scrollWidth > document.documentElement.clientWidth + 1
    ));
    expect(overflow).toBe(false);
  });
});

test.describe('house ladder on a narrow phone', () => {
  test.use({ viewport: { width: 320, height: 568 } });

  test('the ladder fits a 320-wide screen', async ({ page }) => {
    await stubSupabase(page);
    await page.route('**/rest/v1/rpc/my_social', (route) => route.fulfill({ json: standing }));
    await page.route('**/rest/v1/rpc/weekly_board', (route) => route.fulfill({ json: week }));
    await seedSignedIn(page);
    await page.goto('/');
    await expect(page.getByRole('button', { name: 'Battle', exact: true })).toBeVisible(SLOW);
    await page.getByRole('button', { name: 'Rankings', exact: true }).click();
    await page.getByRole('button', { name: 'The ladder', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'The ladder' });
    await expect(dialog.getByRole('tab', { name: 'Your card' })).toBeVisible(SLOW);
    const box = await dialog.boundingBox();
    expect(box.width).toBeLessThanOrEqual(320);
    const overflow = await page.evaluate(() => (
      document.documentElement.scrollWidth > document.documentElement.clientWidth + 1
    ));
    expect(overflow).toBe(false);
  });
});
