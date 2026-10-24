// The account's save (src/lib/cloudSave.js) through the real app, with the
// backend stubbed the way e2e/helpers/session.js stubs it, plus the two save
// RPCs as the migration defines them: get_player_save answers {rev, save,
// updated_at}; put_player_save is a compare-and-swap on rev. Also the
// trophy board and get_my_rank, and the copy each state shows.
import AxeBuilder from '@axe-core/playwright';
import { test, expect, SESSION, REF, SLOW } from './helpers/session.js';
import { getCurrentSeason } from '../src/utils/season.js';

const STORAGE_KEY = 'terrible-teddies-storage';
const AXE_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];
const today = () => new Date().toDateString();

// The stamps the menu writes on a save opened on `day` (syncPeriods,
// syncSeason): the store's own week key is the Monday of that week.
const stampedOn = (day) => {
  const monday = new Date(day.getFullYear(), day.getMonth(), day.getDate() - day.getDay() + (day.getDay() === 0 ? -6 : 1));
  return {
    dailyStatsDate: day.toDateString(),
    weeklyStatsDate: monday.toDateString(),
    seasonKey: getCurrentSeason(day).key,
    lastLoginDate: day.toDateString(),
  };
};
// Two days in one week and one season: Wednesday evening, Thursday morning.
const WEDNESDAY = new Date(2026, 9, 21, 20, 0);
const THURSDAY = new Date(2026, 9, 22, 9, 0);

// What another device sent to the account today (its menu stamped the day,
// week and season): a player well into the game.
const accountSave = (over = {}) => ({
  ...stampedOn(new Date()),
  playerName: 'Phone Bear',
  level: 7, xp: 40, totalBattles: 30, totalWins: 20, coins: 4321,
  ownedCards: [1, 2, 3, 4, 5, 6, 30, 31, 40, 41, 42, 7, 8, 9, 10, 11, 12],
  currentDeck: [1, 2, 3, 4, 5, 6, 30, 40, 41, 42],
  // 500 gems bought on the phone (its mark), 210 left after spending.
  gems: 210, lastSyncedServerGems: 500,
  tutorialCompleted: true, lastLoginDate: today(),
  ...over,
});

const missing = (fn) => ({
  status: 404,
  json: { code: 'PGRST202', message: `Could not find the function public.${fn} without parameters in the schema cache`, details: null, hint: null },
});

/**
 * Boot with a stubbed backend. `account`: the save the account holds (null:
 * none yet), or 'missing' for a backend without the functions, or 'offline'.
 * `store`: this device's save (null: a fresh browser). `balance`: the
 * account's purchased gems. Returns the RPC calls made, as they are made.
 */
async function boot(page, { account = null, store = null, balance = null, rest = {}, rank = null } = {}) {
  const calls = [];
  let row = account && typeof account === 'object'
    ? { rev: 5, save: account, updated_at: new Date().toISOString() }
    : null;

  await page.route('**testproject.supabase.co/**', async (route) => {
    const req = route.request();
    const url = req.url();
    if (url.includes('/auth/v1/user')) return route.fulfill({ json: SESSION.user });
    if (url.includes('/auth/v1/logout')) {
      calls.push({ fn: 'logout' });
      return route.fulfill({ status: 204, body: '' });
    }
    if (url.includes('/auth/v1/')) return route.fulfill({ json: SESSION });

    const fn = url.match(/\/rest\/v1\/rpc\/([a-z_]+)/)?.[1];
    if (fn) {
      const body = req.postDataJSON();
      calls.push({ fn, body, headers: req.headers() });
      if (fn === 'get_player_save' || fn === 'put_player_save') {
        if (account === 'missing') return route.fulfill(missing(fn));
        if (account === 'offline') return route.abort('internetdisconnected');
      }
      if (fn === 'get_player_save') {
        return route.fulfill({ json: row ? { ...row } : { rev: 0, save: null, updated_at: null } });
      }
      if (fn === 'put_player_save') {
        const current = row?.rev ?? 0;
        if (body.p_base_rev !== current) {
          return route.fulfill({ json: { ok: false, rev: current, updated_at: row?.updated_at ?? null } });
        }
        row = { rev: current + 1, save: body.p_save, updated_at: new Date().toISOString() };
        return route.fulfill({ json: { ok: true, rev: row.rev, updated_at: row.updated_at } });
      }
      if (fn === 'get_my_rank') return rank ? route.fulfill({ json: rank }) : route.fulfill(missing(fn));
      return route.fulfill({ json: null });
    }

    const table = url.match(/\/rest\/v1\/([a-z_]+)/)?.[1];
    if (table === 'user_gems') return route.fulfill({ json: balance === null ? null : { gems: balance } });
    if (table && rest[table]) return rest[table](route);
    return route.fulfill({ json: [] });
  });
  await page.route('**assets.mixkit.co/**', (r) => r.abort());
  await page.route('https://*.posthog.com/**', (r) => r.abort());

  await page.addInitScript(([authKey, session, key, state]) => {
    localStorage.setItem(authKey, JSON.stringify(session));
    if (state) localStorage.setItem(key, JSON.stringify({ state, version: 3 }));
  }, [`sb-${REF}-auth-token`, SESSION, STORAGE_KEY, store]);

  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Battle', exact: true })).toBeVisible(SLOW);
  // `write`: another device sending the next rev.
  const write = (save) => {
    row = { rev: (row?.rev ?? 0) + 1, save, updated_at: new Date().toISOString() };
  };
  return { calls, row: () => row, write };
}

const saved = (page) => page.evaluate((key) => JSON.parse(localStorage.getItem(key)).state, STORAGE_KEY);

const openSettings = async (page) => {
  await page.getByRole('button', { name: 'Settings' }).click();
  const dialog = page.getByRole('dialog', { name: 'Settings' });
  await expect(dialog).toBeVisible(SLOW);
  return dialog;
};

test('a new device takes the account\'s save, its gem mark with it: no gem is credited twice', async ({ page }) => {
  // A fresh browser: no save at all. The account bought 500 gems in total.
  const { calls } = await boot(page, { account: accountSave(), store: null, balance: 500 });

  await expect(page.getByText('Save loaded from your account', { exact: true })).toBeVisible(SLOW);
  await expect(page.getByText('Lv 7')).toBeVisible();
  // The phone's 210 gems, not 210 + the 500 a mark of 0 would re-credit.
  await expect.poll(async () => {
    const s = await saved(page);
    return [s.level, s.gems, s.lastSyncedServerGems, s.playerName, s.cloudRev];
  }).toEqual([7, 210, 500, 'Phone Bear', 5]);

  const dialog = await openSettings(page);
  await expect(dialog.getByText(/^Saved to your account · /)).toBeVisible();
  // Already in step: nothing went back up.
  expect(calls.filter((c) => c.fn === 'put_player_save')).toHaveLength(0);

  // A change goes up a few seconds later, from the rev it was in step with.
  await dialog.getByRole('button', { name: /^Hard/ }).click();
  await expect(dialog.getByText('Saving…')).toBeVisible();
  await expect.poll(() => calls.filter((c) => c.fn === 'put_player_save').length, { timeout: 10_000 }).toBe(1);
  const put = calls.find((c) => c.fn === 'put_player_save');
  expect(put.body.p_base_rev).toBe(5);
  expect(put.body.p_save.difficulty).toBe('hard');
  expect(put.body.p_save.lastSyncedServerGems).toBe(500);
  // The device's own switches stay on the device.
  expect(put.body.p_save).not.toHaveProperty('soundEnabled');
  await expect(dialog.getByText(/^Saved to your account · /)).toBeVisible();
});

test('hiding the tab sends a waiting change at once, carrying the session\'s own token', async ({ page }) => {
  const { calls, row } = await boot(page, { account: accountSave(), store: null, balance: 500 });
  await expect(page.getByText('Lv 7')).toBeVisible(SLOW);
  const dialog = await openSettings(page);
  await dialog.getByRole('button', { name: /^Normal/ }).click();
  // Hidden well inside the three seconds a change waits: it goes now, as a
  // keepalive request (the page may be going away), which supabase-js does not
  // send, so this is the hand-built request with its own headers.
  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  const puts = () => calls.filter((c) => c.fn === 'put_player_save');
  await expect.poll(() => puts().length, { timeout: 2000 }).toBe(1);
  const put = puts()[0];
  expect(put.headers.authorization).toBe(`Bearer ${SESSION.access_token}`);
  expect(put.headers.apikey).toBe('test-anon-key');
  expect(put.body.p_base_rev).toBe(5);
  expect(put.body.p_save.difficulty).toBe('normal');
  await expect.poll(() => row().rev).toBe(6);
  // Sent once: the wait it replaced does not send it again.
  await page.waitForTimeout(3500);
  expect(puts()).toHaveLength(1);
});

test('Sign Out sends the last change to the account before signing out', async ({ page }) => {
  const { calls, row } = await boot(page, { account: accountSave(), store: null, balance: 500 });
  await expect(page.getByText('Lv 7')).toBeVisible(SLOW);
  const dialog = await openSettings(page);
  await dialog.getByRole('button', { name: /^Hard/ }).click();
  // Well inside the three-second wait: without Sign Out sending it, this
  // change would never leave the device.
  await dialog.getByRole('button', { name: 'Sign Out' }).click();
  await expect(page.getByRole('button', { name: 'Sign Up' })).toBeVisible(SLOW);
  const order = calls.map((c) => c.fn).filter((fn) => fn === 'put_player_save' || fn === 'logout');
  expect(order).toEqual(['put_player_save', 'logout']);
  expect(row().save.difficulty).toBe('hard');
});

test('when this device and the account both moved, the other save is kept and can be switched to', async ({ page }) => {
  // This device was in step at rev 2, then played a little offline; the
  // account has since gone much further on another device (rev 5).
  const { calls, row } = await boot(page, {
    account: accountSave({ level: 12, totalBattles: 120 }),
    store: {
      ownerUserId: SESSION.user.id, playerName: 'QA Bear', level: 3, totalBattles: 9, coins: 777,
      tutorialCompleted: true, lastLoginDate: today(), cloudRev: 2, cloudSyncedHash: 'an-older-save',
    },
  });

  await expect(page.getByText('Two saves didn’t match', { exact: true })).toBeVisible(SLOW);
  await expect(page.getByText('Lv 12')).toBeVisible();

  const dialog = await openSettings(page);
  await expect(dialog.getByText('Other save on this device')).toBeVisible();
  await expect(dialog.getByText(/^Level 3 · 11 cards · kept /)).toBeVisible();
  await expect.poll(async () => new AxeBuilder({ page }).withTags(AXE_TAGS).analyze().then((r) => r.violations.map((v) => v.id)))
    .toEqual([]);

  await dialog.getByRole('button', { name: 'Switch to this save' }).click();
  await expect(dialog.getByRole('status').filter({ hasText: 'Switched to the Level 3 save' })).toBeVisible();
  // Swapped, not replaced: the account's save is now the other one.
  await expect(dialog.getByText(/^Level 12 · 17 cards · kept /)).toBeVisible();
  await expect.poll(async () => (await saved(page)).coins).toBe(777);

  // The switched-to save goes to the account from the rev it is in step with.
  await expect.poll(() => row()?.rev, { timeout: 10_000 }).toBe(6);
  expect(row().save.level).toBe(3);
  expect(calls.filter((c) => c.fn === 'put_player_save').at(-1).body.p_base_rev).toBe(5);
  await expect(dialog.getByText(/^Saved to your account · /)).toBeVisible();
});

test('a backend without cloud saves says so, changes nothing, and asks no more', async ({ page }) => {
  const store = {
    ownerUserId: SESSION.user.id, playerName: 'QA Bear', level: 4, coins: 1234, gems: 56,
    tutorialCompleted: true, lastLoginDate: today(),
  };
  const { calls } = await boot(page, { account: 'missing', store });

  const dialog = await openSettings(page);
  await expect(dialog.getByText('Saved on this device only')).toBeVisible();
  const s = await saved(page);
  expect([s.level, s.coins, s.gems, s.cloudRev, s.cloudSyncedHash]).toEqual([4, 1234, 56, 0, null]);

  // Changes stay local: no write is even attempted.
  await dialog.getByRole('button', { name: /^Hard/ }).click();
  await page.waitForTimeout(4000);
  expect(calls.filter((c) => c.fn === 'put_player_save')).toHaveLength(0);
  expect(calls.filter((c) => c.fn === 'get_player_save')).toHaveLength(1);
});

test('a server out of reach is said as it is, and the save stays on this device', async ({ page }) => {
  const store = {
    ownerUserId: SESSION.user.id, playerName: 'QA Bear', level: 4, coins: 1234,
    tutorialCompleted: true, lastLoginDate: today(),
  };
  await boot(page, { account: 'offline', store });
  const dialog = await openSettings(page);
  await expect(dialog.getByText('Couldn’t reach the server — saved on this device, will retry')).toBeVisible();
  expect((await saved(page)).level).toBe(4);
});

test('if the cloud save\'s code cannot load, gems are still reconciled as before', async ({ page }) => {
  // The chunk the sign-in loads (the dev module, or the built, hashed one).
  await page.route(/\/(src\/lib\/cloudSave\.js|assets\/cloudSave-[\w-]+\.js)/, (route) => route.abort());
  const store = {
    ownerUserId: SESSION.user.id, playerName: 'QA Bear', gems: 56, lastSyncedServerGems: 0,
    tutorialCompleted: true, lastLoginDate: today(),
  };
  const { calls } = await boot(page, { account: accountSave(), store, balance: 300 });
  // A purchase of 300 the save had not counted: credited, as it always was.
  await expect.poll(async () => (await saved(page)).gems).toBe(356);
  expect(calls.filter((c) => c.fn === 'get_player_save')).toHaveLength(0);
});

test('the leaderboard ranks the player from the server and marks their row', async ({ page }) => {
  const board = Array.from({ length: 50 }, (_, i) => ({
    username: i === 8 ? 'Phone Bear' : `Rival${i + 1}`,
    wins: 400 - i * 3, losses: 10, experience: 4000 - i * 50, best_win_streak: 2,
    trophies: 0, rank: i + 1, is_me: i === 8,
  })).map((r) => ({ ...r, trophies: r.wins * 8 + (Math.floor(r.experience / 100) + 1) * 10 + r.best_win_streak * 5 }));
  await boot(page, {
    account: 'missing',
    store: { ownerUserId: SESSION.user.id, playerName: 'QA Bear', tutorialCompleted: true, lastLoginDate: today() },
    rest: { leaderboard_trophies: (route) => route.fulfill({ json: board }) },
    rank: [{ rank: 9, trophies: board[8].trophies, username: 'Phone Bear', wins: board[8].wins, experience: board[8].experience, best_win_streak: 2 }],
  });
  await page.getByRole('button', { name: 'Rankings', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Leaderboard' });
  await expect(dialog.getByText('50 players ranked.')).toBeAttached(SLOW);
  const yours = dialog.locator('h3:has-text("Your Ranking") + div');
  await expect(yours).toContainText('#9');
  await expect(yours).toContainText('Phone Bear');
  const marked = dialog.locator('ol[start="4"] > li').filter({ hasText: 'YOU' });
  await expect(marked).toHaveCount(1);
  await expect(marked).toContainText('Phone Bear');
  await expect(marked).toContainText('#9');
});

test('without the trophy board, the leaderboard falls back to the old view', async ({ page }) => {
  const rows = Array.from({ length: 50 }, (_, i) => ({
    username: `Rival${i + 1}`, wins: 200 - i * 3, losses: 10, experience: 4000 - i * 50, best_win_streak: 2,
  }));
  await boot(page, {
    account: 'missing',
    store: { ownerUserId: SESSION.user.id, playerName: 'QA Bear', tutorialCompleted: true, lastLoginDate: today() },
    rest: {
      leaderboard_trophies: (route) => route.fulfill({ status: 404, json: { code: 'PGRST205', message: 'Could not find the table' } }),
      leaderboard: (route) => route.fulfill({ json: rows }),
    },
  });
  await page.getByRole('button', { name: 'Rankings', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Leaderboard' });
  await expect(dialog.getByText('Outside the top 50')).toBeAttached(SLOW);
  await expect(dialog.getByText('Rival1', { exact: true })).toBeVisible();
});

test('a device that is only behind on a new day takes the account\'s save, without calling it a conflict', async ({ page }) => {
  // Wednesday: a fresh browser takes the account's save and is in step.
  await page.clock.setFixedTime(WEDNESDAY);
  const { row, write } = await boot(page, {
    account: accountSave({ ...stampedOn(WEDNESDAY), todayWins: 2, todayBattles: 3 }),
    store: null,
    balance: 500,
  });
  await expect(page.getByText('Save loaded from your account', { exact: true })).toBeVisible(SLOW);
  await expect.poll(async () => (await saved(page)).cloudRev).toBe(5);

  // Overnight the phone played on: a level and ten battles more (rev 6).
  write({ ...row().save, ...stampedOn(THURSDAY), todayWins: 0, todayBattles: 0, level: 8, totalBattles: 40 });

  // Thursday this device opens the game, untouched since its sync. The menu
  // rolls its save over to the new day before the account has answered.
  await page.clock.setFixedTime(THURSDAY);
  await page.reload();
  await expect(page.getByText('Save loaded from your account', { exact: true })).toBeVisible(SLOW);
  await expect(page.getByText('Lv 8')).toBeVisible();
  await expect(page.getByText('Two saves didn’t match', { exact: true })).toHaveCount(0);
  expect(await page.evaluate((uid) => localStorage.getItem(`terrible-teddies-backup:${uid}`), SESSION.user.id)).toBeNull();
  expect(row().rev).toBe(6); // nothing of this device's went over it
});

test('an account save from an earlier day is brought up to today: yesterday\'s wins finish no challenge', async ({ page }) => {
  await page.clock.setFixedTime(THURSDAY);
  const { calls } = await boot(page, {
    account: accountSave({
      ...stampedOn(WEDNESDAY), lastLoginDate: THURSDAY.toDateString(),
      todayWins: 9, todayBattles: 20, todayDamageDealt: 99_999, todayCardsPlayed: 500, claimedChallenges: [],
    }),
    store: null,
    balance: 500,
  });
  await expect(page.getByText('Save loaded from your account', { exact: true })).toBeVisible(SLOW);
  await expect(page.getByText('Lv 7')).toBeVisible();
  // The menu's own rollover ran on the empty save this one replaced.
  await expect(page.getByRole('button', { name: /^Challenges/ })).not.toContainText('ready');
  const s = await saved(page);
  expect([s.todayWins, s.todayBattles, s.dailyStatsDate]).toEqual([0, 0, THURSDAY.toDateString()]);
  // And the rolled-over save goes back to the account, from the rev it took.
  await expect.poll(() => calls.filter((c) => c.fn === 'put_player_save').length, { timeout: 10_000 }).toBe(1);
  const put = calls.find((c) => c.fn === 'put_player_save');
  expect(put.body.p_base_rev).toBe(5);
  expect(put.body.p_save.todayWins).toBe(0);
});

test('reloading or closing mid-battle sends the abandoned battle\'s loss to the account on the way out', async ({ page }) => {
  const { calls, row } = await boot(page, { account: accountSave(), store: null, balance: 500 });
  await expect(page.getByText('Save loaded from your account', { exact: true })).toBeVisible(SLOW);
  await expect.poll(async () => (await saved(page)).cloudRev).toBe(5);
  await page.getByRole('button', { name: 'Battle', exact: true }).click();
  await expect(page.getByRole('button', { name: 'End Turn' })).toBeVisible(SLOW);
  expect((await saved(page)).totalLosses).toBe(0);
  const before = calls.length;

  // From here no timer runs, as none does once a page has gone: the save's
  // usual three-second wait cannot be what sends the loss.
  await page.clock.install();
  // A reload or close, in the browser's own order: pagehide while the tab is
  // still visible (GameBoard's listener, after the cloud save's, books the
  // loss), then hidden. Fired here rather than by a real reload: Playwright
  // now and then loses the intercepted keepalive request of a page that has
  // really gone, which would make this test flaky rather than the app.
  await page.evaluate(() => {
    window.dispatchEvent(new PageTransitionEvent('pagehide', { persisted: false }));
    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  expect((await saved(page)).totalLosses).toBe(1); // booked by GameBoard

  await expect.poll(() => row().save.totalLosses ?? 0, { timeout: 10_000 }).toBe(1);
  const sent = calls.slice(before).filter((c) => c.fn === 'put_player_save');
  expect(sent).toHaveLength(1);
  expect(sent[0].body.p_base_rev).toBe(5);
  expect(sent[0].headers.authorization).toBe(`Bearer ${SESSION.access_token}`);
  expect(row().rev).toBe(6);
});
