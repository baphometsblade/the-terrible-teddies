// The Battle Pass, end to end: the menu tile's badge, what a claim says it
// handed over, the routes to gems and back out of the store dialogs, and a
// season's end delivering what was left unclaimed.
import { test, expect, bootToMainMenu, SLOW } from './helpers/session.js';
import { getCurrentSeason, getSeason } from '../src/utils/season.js';
import { BATTLE_PASS_REWARDS, PREMIUM_PASS_PRICE } from '../src/lib/battlePass.js';

const season = getCurrentSeason();
const firstCard = BATTLE_PASS_REWARDS.find((r) => r.premium?.type === 'card');
const firstPassPack = BATTLE_PASS_REWARDS.find((r) => r.free?.type === 'pack');

test.beforeEach(async ({ page }) => {
  await bootToMainMenu(page);
});

// Patch the seeded save and reload into it (the boot's own seed runs first).
async function seed(page, patch) {
  await page.addInitScript((p) => {
    const raw = localStorage.getItem('terrible-teddies-storage');
    const stored = raw ? JSON.parse(raw) : { state: {}, version: 3 };
    Object.assign(stored.state, p);
    localStorage.setItem('terrible-teddies-storage', JSON.stringify(stored));
  }, { seasonKey: season.key, ...patch });
  await page.reload();
  await expect(page.getByRole('button', { name: 'Battle', exact: true })).toBeVisible(SLOW);
}

const passTile = (page) => page.getByRole('button', { name: 'Battle Pass', exact: true });

async function openPass(page) {
  await passTile(page).click();
  const pass = page.getByRole('dialog', { name: 'Battle Pass' });
  await expect(pass).toBeVisible(SLOW);
  return pass;
}

test('the menu tile badges what is ready, and goes quiet once it is claimed', async ({ page }) => {
  await seed(page, { seasonXP: 0, claimedBattlePassRewards: { free: [], premium: [] } });
  await expect(passTile(page)).toHaveAccessibleDescription('1 ready');
  const pass = await openPass(page);
  await expect(pass.getByText('1 ready', { exact: true })).toBeVisible();
  await pass.getByRole('button', { name: /^Claim tier 1 free reward/ }).click();
  await expect(page.getByText('Coins Claimed!').first()).toBeVisible(SLOW);
  await pass.getByRole('button', { name: 'Close battle pass' }).click();
  await expect(pass).toHaveCount(0, SLOW);
  await expect(passTile(page)).not.toHaveAttribute('aria-describedby');
  await expect(passTile(page)).not.toHaveClass(/trim-brass/);
});

test('a card already owned says so before the claim, and after it says what it paid', async ({ page }) => {
  await seed(page, {
    seasonXP: firstCard.xpRequired, hasBattlePassPremium: true,
    ownedCards: [1, 2, 3, 4, 5, 6, firstCard.premium.cardId, 30, 31, 40, 41, 42],
    claimedBattlePassRewards: { free: [], premium: [] },
  });
  const pass = await openPass(page);
  const claim = pass.getByRole('button', { name: new RegExp(`^Claim tier ${firstCard.tier} premium reward`) });
  await expect(claim).toContainText('Owned');
  await claim.click();
  await expect(page.getByText('Already owned').first()).toBeVisible(SLOW);
  await expect(page.getByText(new RegExp(`${firstCard.premium.name} → \\+\\d+ coins`)).first()).toBeVisible();
  await expect(page.getByText('Card Unlocked!')).toHaveCount(0);
});

test("short of gems, the Premium confirm's Get gems opens the Shop on gems, and focus finds its way home", async ({ page }) => {
  await seed(page, { gems: PREMIUM_PASS_PRICE - 1 });
  const pass = await openPass(page);
  await pass.getByRole('button', { name: /^Unlock Premium/ }).click();
  const confirm = page.getByRole('dialog', { name: 'Unlock Premium Pass' });
  await expect(confirm).toBeVisible();
  // The term is stated before the price.
  await expect(confirm).toContainText(`Premium lasts for ${season.name}`);
  await expect(confirm.getByRole('button', { name: 'Purchase' })).toHaveCount(0);
  await expect(confirm.getByRole('button', { name: 'Cancel' })).toBeFocused();
  await confirm.getByRole('button', { name: 'Get gems' }).click();

  const shop = page.getByRole('dialog', { name: 'Shop' });
  await expect(shop).toBeVisible(SLOW);
  await expect(pass).toHaveCount(0);
  await expect(shop.getByRole('button', { name: 'Buy Gems' })).toHaveAttribute('aria-pressed', 'true');
  await expect(shop.getByText('Get More Gems')).toBeVisible();
  // Focus moved into the Shop, and stayed there (the pass leaving did not
  // pull it back out onto the menu).
  await expect.poll(() => shop.evaluate((el) => el.contains(document.activeElement))).toBe(true);
  await page.waitForTimeout(400);
  expect(await shop.evaluate((el) => el.contains(document.activeElement))).toBe(true);
  await page.keyboard.press('Escape');
  await expect(shop).toHaveCount(0, SLOW);
  await expect(passTile(page)).toBeFocused();
  // Opened normally, the Shop is on Card Packs again.
  await page.getByRole('button', { name: 'Shop', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Shop' }).getByRole('button', { name: 'Card Packs', exact: true })).toHaveAttribute('aria-pressed', 'true', SLOW);
});

test.describe('at 320x640', () => {
  test.use({ viewport: { width: 320, height: 640 } });
  // The confirm is taller than this screen and opens scrolled to its buttons
  // (Cancel takes focus): the term has to be on screen with them.
  test('the Premium term is on screen with the price and the buttons', async ({ page }) => {
    await seed(page, {});
    const pass = await openPass(page);
    await pass.getByRole('button', { name: /^Unlock Premium/ }).click();
    const confirm = page.getByRole('dialog', { name: 'Unlock Premium Pass' });
    await expect(confirm.getByRole('button', { name: 'Cancel' })).toBeFocused();
    await page.waitForTimeout(500);
    for (const el of [confirm.locator('[data-pass-term]'), confirm.getByText('Price', { exact: true }), confirm.getByRole('button', { name: 'Cancel' })]) {
      await expect(el).toBeInViewport({ ratio: 1 });
    }
  });
});

test.describe('at 1024x800', () => {
  test.use({ viewport: { width: 1024, height: 800 } });
  // From lg the header is one row, and the wallet's width grows with the
  // balances. A gradient title squeezed narrower than its text draws the rest
  // transparent ("Battle Pas" at 48,210 coins), and a row wider than the panel
  // clips the close button. Neither may happen at any balance.
  test('the title stays whole and the close button inside the panel, however rich the player', async ({ page }) => {
    for (const [coins, gems] of [[12345, 560], [48210, 1320], [250000, 9999], [1234567, 99999]]) {
      await seed(page, { coins, gems });
      const pass = await openPass(page);
      await expect(pass.getByText(coins.toLocaleString('en-US'), { exact: true })).toBeVisible();
      // Each comparison is between two boxes inside the panel, which scale
      // together, so it holds mid-way through the panel's entrance too.
      const m = await pass.evaluate((dialog) => {
        const h = dialog.querySelector('h2');
        const range = document.createRange();
        range.selectNodeContents(h);
        const close = dialog.querySelector('[aria-label="Close battle pass"]').getBoundingClientRect();
        const box = dialog.querySelector('.dialog-panel').getBoundingClientRect();
        return {
          text: range.getBoundingClientRect().width, title: h.getBoundingClientRect().width,
          closeRight: close.right, panelRight: box.right,
        };
      });
      expect(m.text, `title at ${coins} coins / ${gems} gems`).toBeLessThanOrEqual(m.title + 0.5);
      expect(m.closeRight, `close at ${coins} coins / ${gems} gems`).toBeLessThanOrEqual(m.panelRight);
      await pass.getByRole('button', { name: 'Close battle pass' }).click();
      await expect(pass).toHaveCount(0, SLOW);
    }
  });
});

test('the empty Card Packs table routes to gems and to a reached Battle Pass tier', async ({ page }) => {
  await seed(page, {
    cardPacks: 0, premiumPacks: 0, legendaryPacks: 0, coins: 0, gems: 0,
    seasonXP: firstPassPack.xpRequired, claimedBattlePassRewards: { free: [], premium: [] },
  });
  const cardPacksTile = page.getByRole('button', { name: 'Card Packs', exact: true });
  await cardPacksTile.click();
  let packs = page.getByRole('dialog', { name: 'Card packs' });
  await expect(packs.getByRole('heading', { name: 'No packs to open' })).toBeVisible(SLOW);
  await packs.getByRole('button', { name: 'Get gems' }).click();
  const shop = page.getByRole('dialog', { name: 'Shop' });
  await expect(shop.getByRole('button', { name: 'Buy Gems' })).toHaveAttribute('aria-pressed', 'true', SLOW);
  await expect(packs).toHaveCount(0);
  await page.keyboard.press('Escape');
  await expect(shop).toHaveCount(0, SLOW);
  await expect(cardPacksTile).toBeFocused();

  await cardPacksTile.click();
  packs = page.getByRole('dialog', { name: 'Card packs' });
  await packs.getByRole('button', { name: 'Open the Battle Pass' }).click();
  const pass = page.getByRole('dialog', { name: 'Battle Pass' });
  await expect(pass).toBeVisible(SLOW);
  await expect(packs).toHaveCount(0);
  await expect(pass.getByRole('button', { name: new RegExp(`^Claim tier ${firstPassPack.tier} free reward`) })).toBeVisible();
});

test("a season's end delivers what was left unclaimed, and says so", async ({ page }) => {
  const last = getSeason(season.number - 1);
  await seed(page, {
    seasonKey: last.key, seasonXP: firstPassPack.xpRequired, hasBattlePassPremium: false,
    claimedBattlePassRewards: { free: [], premium: [] }, cardPacks: 0, unlockedCosmetics: ['Gold Border'],
  });
  await expect(page.getByText(`${last.name} rewards delivered`, { exact: true })).toBeVisible(SLOW);
  await expect(page.getByText(/^Unclaimed when the season ended: .*card pack/)).toBeVisible();
  // The packs it delivered are waiting, the pass has started over, and the
  // border the pass sold is still the player's.
  await expect(page.getByRole('button', { name: 'Card Packs', exact: true })).toHaveAccessibleDescription(`${firstPassPack.free.amount} to open`);
  const saved = () => page.evaluate(() => JSON.parse(localStorage.getItem('terrible-teddies-storage')).state);
  expect(await saved()).toMatchObject({
    seasonKey: season.key, seasonXP: 0, cardPacks: firstPassPack.free.amount, unlockedCosmetics: ['Gold Border'],
  });
  // Once: the pass and Card Packs each roll the season on open too, and
  // neither delivers it again. (A reload would replay this test's seed.)
  const pass = await openPass(page);
  await pass.getByRole('button', { name: 'Close battle pass' }).click();
  await expect(pass).toHaveCount(0, SLOW);
  await page.getByRole('button', { name: 'Card Packs', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Card packs' }).getByRole('button', { name: /^Open Pack/ })).toBeVisible(SLOW);
  expect((await saved()).cardPacks).toBe(firstPassPack.free.amount);
});
