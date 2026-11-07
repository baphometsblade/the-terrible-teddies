// The public landing, the cookie notice and the staff desk. The rest of the
// suite seeds a door pass and an analytics choice; these turn those off.
import AxeBuilder from '@axe-core/playwright';
import { test, expect, stubSupabase, seedSignedIn, SLOW } from './helpers/session.js';

const AXE_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

test.describe('the public landing', () => {
  test.use({ doorPassed: false, consentGranted: false });

  test('is what a new device sees, and the door is one press away', async ({ page }) => {
    const requests = [];
    page.on('request', (r) => requests.push(r.url()));
    await stubSupabase(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Terrible Teddies', level: 1 })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'ID.' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Battle', exact: true })).toHaveCount(0);
    await expect(page.locator('#root').getByText('Stuffed animals with late-night habits.')).toBeVisible();
    const enter = page.getByRole('button', { name: "I'm old enough. Check the door." });
    const box = await enter.boundingBox();
    expect(box.width).toBeGreaterThanOrEqual(44);
    expect(box.height).toBeGreaterThanOrEqual(44);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
    expect(overflow).toBe(false);
    expect(requests.some((u) => /\/cards\/.*\.webp/.test(u))).toBe(false);
    const axe = await new AxeBuilder({ page }).withTags(AXE_TAGS).analyze();
    expect(axe.violations, axe.violations.map((v) => v.id).join(', ')).toEqual([]);
    await enter.click();
    await expect(page.getByRole('heading', { name: 'ID.', level: 1 })).toBeVisible(SLOW);
  });
});

test.describe('the cookie notice', () => {
  test.use({ consentGranted: false });

  test('can be refused, and the refusal sticks', async ({ page }) => {
    await stubSupabase(page);
    await seedSignedIn(page);
    await page.goto('/');
    await expect(page.getByRole('button', { name: 'Battle', exact: true })).toBeVisible(SLOW);
    const refuse = page.getByRole('button', { name: 'Refuse' });
    await expect(refuse).toBeVisible();
    const box = await refuse.boundingBox();
    expect(box.height).toBeGreaterThanOrEqual(44);
    await refuse.click();
    await expect(refuse).toHaveCount(0);
    await page.reload();
    await expect(page.getByRole('button', { name: 'Battle', exact: true })).toBeVisible(SLOW);
    await expect(page.getByRole('button', { name: 'Refuse' })).toHaveCount(0);
  });
});

test.describe('the staff desk', () => {
  test('tells a signed-in player who is not staff', async ({ page }) => {
    await stubSupabase(page);
    await seedSignedIn(page);
    await page.goto('/admin');
    await expect(page.getByRole('heading', { name: 'Staff desk' })).toBeVisible(SLOW);
    await expect(page.getByText('This desk is for staff.')).toBeVisible();
    await expect(page.getByText('Counts only. No names, no emails, no saves.')).toBeVisible();
  });
});
