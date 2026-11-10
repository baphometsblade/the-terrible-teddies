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

const room = { ok: true, cup: { played: 0, entered: false }, referral_code: 'abc1234567' };

const pals = [{
  user_id: '22222222-2222-4222-8222-222222222222',
  username: 'DreadBear',
  discord_name: 'dread',
  x_name: 'dreadbear',
  rating: 1050,
  tier: 'Getting Handsy',
  since: '2026-11-01T00:00:00Z',
}];

const ticket = {
  ok: true,
  mode: 'ghost',
  match_id: '33333333-3333-4333-8333-333333333333',
  rival_name: 'DreadBear',
  label: 'Saved deck',
  deck: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
  rival_rating: 1050,
  your_rating: 1100,
  kind: 'challenge',
  seam: 'ladder_matches',
};

async function boot(page) {
  await stubSupabase(page);
  await page.route('**/auth/v1/settings**', (route) => route.fulfill({
    json: { external: { discord: true, twitter: true } },
  }));
  await page.route('**/rest/v1/rpc/my_social', (route) => route.fulfill({ json: standing }));
  await page.route('**/rest/v1/rpc/weekly_board', (route) => route.fulfill({ json: [] }));
  await page.route('**/rest/v1/rpc/my_room', (route) => route.fulfill({ json: room }));
  await page.route('**/rest/v1/rpc/list_friends', (route) => route.fulfill({ json: pals }));
  await page.route('**/rest/v1/rpc/list_friend_requests', (route) => route.fulfill({ json: [] }));
  await page.route('**/rest/v1/rpc/suggest_friends', (route) => route.fulfill({ json: { ok: true, rows: [] } }));
  await page.route('**/rest/v1/rpc/my_links', (route) => route.fulfill({
    json: {
      ok: true,
      discord: { linked: false, name: null },
      x: { linked: false, name: null },
      appear_offline: false,
    },
  }));
  await page.route('**/rest/v1/rpc/friend_ghosts', (route) => route.fulfill({ json: pals.map((row) => ({
    ...row, code: 'bbbbbbbbbb', label: 'Saved deck',
  })) }));
  await page.route('**/rest/v1/rpc/friends_board', (route) => route.fulfill({ json: [
    { place: 1, username: 'DreadBear', rating: 1050, tier: 'Getting Handsy', week_wins: 1, week_losses: 0, week_delta: 12, code: 'bbbbbbbbbb', is_me: false, user_id: pals[0].user_id },
    { place: 2, username: 'QA Bear', rating: 1100, tier: 'Getting Handsy', week_wins: 2, week_losses: 1, week_delta: 20, code: 'abcdef1234', is_me: true, user_id: '11111111-1111-4111-8111-111111111111' },
  ] }));
  await page.route('**/rest/v1/rpc/create_friend_invite', (route) => route.fulfill({
    json: { ok: true, code: 'abcdef123456' },
  }));
  await page.route('**/rest/v1/rpc/challenge_friend', (route) => route.fulfill({ json: ticket }));
  await seedSignedIn(page);
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Battle', exact: true })).toBeVisible(SLOW);
}

test.describe('pals', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('lists a friend and challenges their deck', async ({ page }) => {
    await boot(page);
    await page.getByRole('button', { name: 'Rankings', exact: true }).click();
    await page.getByRole('button', { name: 'The ladder', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'The ladder' });
    await dialog.getByRole('tab', { name: 'The room' }).click();
    await expect(dialog.getByRole('heading', { name: 'Pals' })).toBeVisible();
    await dialog.getByRole('button', { name: /DreadBear/ }).click();
    await dialog.getByRole('button', { name: 'Slide into their DMs. Well, their deck.' }).click();
    await expect(page.getByRole('log').getByText('DreadBear stepped out.')).toBeVisible(SLOW);
  });

  test('invite link, QR, and the X share do not call X', async ({ page }) => {
    const xCalls = [];
    page.on('request', (request) => {
      if (/api\.(x|twitter)\.com/.test(request.url())) xCalls.push(request.url());
    });
    await boot(page);
    await page.getByRole('button', { name: 'Rankings', exact: true }).click();
    await page.getByRole('button', { name: 'The ladder', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'The ladder' });
    await dialog.getByRole('tab', { name: 'The room' }).click();
    await dialog.getByRole('button', { name: 'Write an invite' }).click();
    await expect(dialog.getByText('https://terribleteddies.vercel.app/?friend=abcdef123456')).toBeVisible();
    await expect(dialog.getByRole('img', { name: 'Invite QR code' })).toBeVisible();
    const share = dialog.getByRole('link', { name: 'Share the invite on X' });
    await expect(share).toHaveAttribute('href', /x\.com\/intent\/post/);
    expect(xCalls).toEqual([]);
  });

  test('Discord linking asks for identify and guilds, and stays put when mocked', async ({ page }) => {
    let authorize = '';
    await boot(page);
    await page.route('**/auth/v1/user/identities/authorize**', (route) => {
      authorize = route.request().url();
      return route.fulfill({ json: { url: 'https://example.test/discord-oauth' } });
    });
    await page.route('https://example.test/**', (route) => route.fulfill({
      contentType: 'text/html',
      body: '<!doctype html><title>discord</title>',
    }));
    await page.getByRole('button', { name: 'Rankings', exact: true }).click();
    await page.getByRole('button', { name: 'The ladder', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'The ladder' });
    await dialog.getByRole('tab', { name: 'The room' }).click();
    await dialog.getByRole('button', { name: 'Link Discord' }).click();
    await page.waitForURL('**/discord-oauth');
    expect(decodeURIComponent(authorize)).toContain('provider=discord');
    expect(decodeURIComponent(authorize)).toContain('scopes=identify guilds');
    expect(authorize).not.toMatch(/follows/);
  });

  test('the friends ladder ranks pals only', async ({ page }) => {
    await boot(page);
    await page.getByRole('button', { name: 'Rankings', exact: true }).click();
    await page.getByRole('button', { name: 'The ladder', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'The ladder' });
    await dialog.getByRole('tab', { name: 'This week' }).click();
    await dialog.getByRole('tab', { name: 'Friends' }).click();
    await expect(dialog.getByRole('button', { name: /DreadBear/ })).toBeVisible();
    await expect(dialog.getByRole('button', { name: /QA Bear/ })).toBeVisible();
  });
});

test.describe('pals on a narrow phone', () => {
  test.use({ viewport: { width: 320, height: 568 } });

  test('the pals list fits', async ({ page }) => {
    await boot(page);
    await page.getByRole('button', { name: 'Rankings', exact: true }).click();
    await page.getByRole('button', { name: 'The ladder', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'The ladder' });
    await dialog.getByRole('tab', { name: 'The room' }).click();
    await expect(dialog.getByRole('heading', { name: 'Pals' })).toBeVisible(SLOW);
    const box = await dialog.boundingBox();
    expect(box.width).toBeLessThanOrEqual(320);
    const overflow = await page.evaluate(() => (
      document.documentElement.scrollWidth > document.documentElement.clientWidth + 1
    ));
    expect(overflow).toBe(false);
  });
});
