import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// The account's save, as the migration's two functions keep it: one row per
// account, written only by a compare-and-swap on rev. Every response has
// supabase-js's own shape, so the module is tested on what it really gets.
const server = {
  rows: new Map(),
  as: null,          // the signed-in account the calls act for
  mode: 'ok',        // 'ok' | 'missing' | 'offline' | 'null' | 'lose-answer'
  calls: [],
  reset() {
    this.afterGet = null;
    this.gate = null;
    this.rows = new Map();
    this.as = null;
    this.mode = 'ok';
    this.calls = [];
  },
  // Another device writing to the account, through the same rules.
  write(uid, save) {
    const row = this.rows.get(uid);
    const rev = (row?.rev ?? 0) + 1;
    this.rows.set(uid, { rev, save: JSON.parse(JSON.stringify(save)), updated_at: new Date().toISOString() });
    return rev;
  },
  failure() {
    if (this.mode === 'missing') {
      return { data: null, error: { code: 'PGRST202', message: 'Could not find the function public.get_player_save' }, status: 404 };
    }
    if (this.mode === 'offline') return { data: null, error: { code: '', message: 'TypeError: Failed to fetch' }, status: 0 };
    if (this.mode === 'null') return { data: null, error: null, status: 200 };
    return null;
  },
  get() {
    this.calls.push({ fn: 'get' });
    const fail = this.failure();
    if (fail) return fail;
    const row = this.rows.get(this.as);
    const answer = {
      data: row ? { rev: row.rev, save: JSON.parse(JSON.stringify(row.save)), updated_at: row.updated_at } : { rev: 0, save: null, updated_at: null },
      error: null,
      status: 200,
    };
    // Another device writing just after this read was answered.
    const after = this.afterGet;
    this.afterGet = null;
    after?.();
    return answer;
  },
  put(save, base, extra = {}) {
    this.calls.push({ fn: 'put', base, save, ...extra });
    if (this.mode !== 'lose-answer') {
      const fail = this.failure();
      if (fail) return fail;
    }
    const row = this.rows.get(this.as);
    const current = row?.rev ?? 0;
    let answer;
    if (current !== base) {
      answer = { ok: false, rev: current, updated_at: row?.updated_at ?? null };
    } else {
      const rev = this.write(this.as, save);
      answer = { ok: true, rev, updated_at: this.rows.get(this.as).updated_at };
    }
    // The write landed, but the answer never came back.
    if (this.mode === 'lose-answer') return { data: null, error: { code: '', message: 'TypeError: Failed to fetch' }, status: 0 };
    return { data: answer, error: null, status: 200 };
  },
  puts() {
    return this.calls.filter((c) => c.fn === 'put');
  },
};

vi.mock('@/utils/supabaseClient', () => ({
  getPlayerSave: vi.fn(async () => server.get()),
  // `gate`: a plain (not keepalive) write waits on it before it reaches the
  // server, as one still out when the page goes.
  putPlayerSave: vi.fn(async (save, base) => {
    if (server.gate) await server.gate;
    return server.put(save, base);
  }),
  putPlayerSaveKeepalive: vi.fn(async (save, base, token) => server.put(save, base, { keepalive: true, token })),
}));

const toasts = [];
vi.mock('@/components/ui/use-toast', () => ({ toast: (t) => toasts.push(t) }));

const {
  decideSync, progressOf, isFreshSave, holdsPaidItems, cloudPayload, saveHash, classifyRpc,
  startCloudSync, stopCloudSync, bindSaveToUser, switchToBackupSave, saveNow, readBackup,
  useCloudSave, describeSaveStatus, PUSH_DEBOUNCE_MS, RETRY_BASE_MS, RECHECK_MIN_MS, CLOUD_FIELDS, CLOUD_SAVE_MAX_BYTES,
  lastSyncedSave, rollForward,
} = await import('./cloudSave');
const { useGameStore, BATTLE_XP, scratchGameStore } = await import('@/stores/gameStore');
const { BATTLE_PASS_REWARDS } = await import('@/lib/battlePass');

const A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const get = () => useGameStore.getState();
const phase = () => useCloudSave.getState().phase;
const payloadNow = () => cloudPayload(get());
const STORAGE_KEY = 'terrible-teddies-storage';

// The day, week and season stamps a save opened today carries: the menu
// writes them on every device (syncPeriods, syncSeason) before anything else.
const stampedToday = () => {
  const s = scratchGameStore({});
  s.getState().syncSeason();
  s.getState().syncPeriods();
  const { dailyStatsDate, weeklyStatsDate, seasonKey } = s.getState();
  return { dailyStatsDate, weeklyStatsDate, seasonKey };
};

// A save that has played: what another device would have sent today.
const played = (over = {}) => cloudPayload({
  ...useGameStore.getInitialState(),
  level: 7, xp: 40, totalBattles: 30, totalWins: 20,
  ownedCards: [1, 2, 3, 4, 5, 6, 30, 31, 40, 41, 42, 7, 8, 9, 10, 11, 12],
  coins: 4321, gems: 210, lastSyncedServerGems: 500, tutorialCompleted: true,
  playerName: 'Phone Bear',
  ...stampedToday(),
  ...over,
});

const setVisibility = (state) => {
  Object.defineProperty(document, 'visibilityState', { value: state, configurable: true });
  document.dispatchEvent(new Event('visibilitychange'));
};

// Start the cloud save the way App does: bind, then start, collecting what
// onSettled hears. `reconcile` stands in for App's gem reconcile.
const signIn = async (uid = A, { balance = null } = {}) => {
  server.as = uid;
  const settled = [];
  bindSaveToUser(uid);
  const out = await startCloudSync({
    userId: uid,
    accessToken: `token-${uid}`,
    onSettled: (o) => {
      settled.push(o);
      if (balance !== null) get().reconcileServerGems(balance, uid);
    },
  });
  return { out, settled };
};

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });
  localStorage.clear();
  useGameStore.setState(useGameStore.getInitialState(), true);
  server.reset();
  toasts.length = 0;
  delete document.documentElement.dataset.screen;
});

afterEach(() => {
  stopCloudSync();
  delete document.visibilityState;
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('the decision table', () => {
  const local = (over = {}) => ({ hash: 'L', syncedHash: 'S', rev: 4, progress: 1000, fresh: false, ...over });
  const remote = (over = {}) => ({ rev: 5, hash: 'R', progress: 1000, ...over });

  it('1: no save on the account yet → send this one from rev 0', () => {
    expect(decideSync({ local: local(), server: { rev: 0, hash: null, progress: 0 } }))
      .toEqual({ action: 'push', baseRev: 0, rule: 1 });
  });

  it('2: the same save on both sides → in step', () => {
    expect(decideSync({ local: local({ hash: 'R' }), server: remote() })).toMatchObject({ action: 'in-sync', baseRev: 5 });
  });

  it('3: the account holds what this device last synced → send this one on top', () => {
    expect(decideSync({ local: local({ rev: 5, syncedHash: 'R' }), server: remote() }))
      .toMatchObject({ action: 'push', baseRev: 5, rule: 3 });
    // Same rev but a different save there (the row was recreated): not ours.
    expect(decideSync({ local: local({ rev: 5, syncedHash: 'X', hash: 'X' }), server: remote() }).action).toBe('adopt');
  });

  it('3: the account holds a save this device sent (an answer it never got) → send on top, no backup', () => {
    const verdict = decideSync({ local: local(), server: remote(), seen: new Set(['R']) });
    expect(verdict).toEqual({ action: 'push', baseRev: 5, rule: 3 });
  });

  it('4: untouched here since the last sync, the account moved → take the account\'s', () => {
    expect(decideSync({ local: local({ hash: 'S' }), server: remote({ progress: 1 }) })).toEqual({ action: 'adopt', rule: 4 });
    // Changed only by the calendar: the last synced save, rolled forward to today.
    expect(decideSync({ local: local({ hash: 'S+today', rolledHashes: ['S+today'] }), server: remote({ progress: 1 }) }))
      .toEqual({ action: 'adopt', rule: 4 });
    // Anything else is a change of this device's own.
    expect(decideSync({ local: local({ hash: 'L', rolledHashes: ['S+today'] }), server: remote({ progress: 1 }) }).rule).toBe(6);
  });

  it('5: a never-synced save with nothing in it → take the account\'s, no backup', () => {
    expect(decideSync({ local: local({ syncedHash: null, fresh: true, progress: 9999 }), server: remote() }))
      .toEqual({ action: 'adopt', rule: 5 });
  });

  it('6: both moved → keep more progress, back up the other; a tie keeps this device\'s', () => {
    expect(decideSync({ local: local({ progress: 2000 }), server: remote() }))
      .toEqual({ action: 'push', baseRev: 5, backup: 'server', rule: 6 });
    expect(decideSync({ local: local({ progress: 1000 }), server: remote({ progress: 1000 }) }))
      .toMatchObject({ action: 'push', backup: 'server' });
    expect(decideSync({ local: local({ progress: 999 }), server: remote() }))
      .toEqual({ action: 'adopt', backup: 'local', rule: 6 });
  });
});

describe('progress and the empty save', () => {
  it('only goes up in play: XP, level-ups, cards and battles', () => {
    const seen = [progressOf(get())];
    const step = () => seen.push(progressOf(get()));
    get().addXP(30); step();
    get().addXP(5000); step(); // several level-ups at once
    get().addCards([7, 8, 9]); step();
    get().addCards([7]); step(); // a duplicate adds coins, not progress
    get().recordBattleResult(false); step();
    get().recordBattleResult(true); step();
    for (let i = 1; i < seen.length; i += 1) expect(seen[i]).toBeGreaterThanOrEqual(seen[i - 1]);
    expect(seen.at(-1)).toBeGreaterThan(seen[0]);
    // A reset is the one thing that lowers it.
    get().resetProgress();
    expect(progressOf(get())).toBeLessThan(seen.at(-1));
  });

  it('counts a card as much as a won battle\'s XP', () => {
    const base = progressOf(get());
    get().addCards([7]);
    expect(progressOf(get()) - base).toBe(BATTLE_XP.win);
  });

  it('a new save is empty; coins from a first daily reward leave it empty', () => {
    expect(isFreshSave(get())).toBe(true);
    get().addCoins(50);
    expect(isFreshSave(get())).toBe(true);
    get().recordBattleResult(true);
    expect(isFreshSave(get())).toBe(false);
  });

  it('a wiped save still holding what a reset keeps is not empty (keptThroughReset)', () => {
    useGameStore.setState({ gems: 3000, lastSyncedServerGems: 3000, level: 9 });
    get().resetProgress();
    expect(progressOf(get())).toBe(progressOf(useGameStore.getInitialState()));
    expect(holdsPaidItems(get())).toBe(true);
    expect(isFreshSave(get())).toBe(false);
    // Each paid item on its own.
    for (const over of [{ premiumPacks: 1 }, { legendaryPacks: 1 }, { unlockedCosmetics: ['Gold Border'] },
      { coinDoublerExpiresAt: Date.now() + 60_000 }]) {
      expect(holdsPaidItems({ ...useGameStore.getInitialState(), ...over })).toBe(true);
    }
  });
});

describe('what goes to the account', () => {
  it('leaves out the device\'s own settings and the bookkeeping, and carries the gem mark', () => {
    for (const k of ['soundEnabled', 'animationsEnabled', 'musicEnabled', 'ownerUserId', 'cloudRev', 'cloudSyncedHash', 'cloudSyncedAt']) {
      expect(CLOUD_FIELDS).not.toContain(k);
    }
    expect(CLOUD_FIELDS).toContain('lastSyncedServerGems');
    expect(CLOUD_FIELDS).toContain('ownedCards');
  });

  it('fingerprints a save the same whatever order its keys come back in', () => {
    const save = played();
    const reordered = Object.fromEntries(Object.entries(save).reverse());
    expect(saveHash(reordered)).toBe(saveHash(save));
    expect(saveHash({ ...save, coins: save.coins + 1 })).not.toBe(saveHash(save));
  });

  it('reads PostgREST\'s answers', () => {
    const ok = (d) => (d ? { ok: true } : null);
    expect(classifyRpc({ data: null, error: { code: 'PGRST202' }, status: 404 }, ok).kind).toBe('unavailable');
    expect(classifyRpc({ data: null, error: { code: '42501' }, status: 403 }, ok).kind).toBe('unavailable');
    expect(classifyRpc({ data: null, error: null, status: 200 }, ok).kind).toBe('unavailable');
    expect(classifyRpc({ data: null, error: { code: 'PT413' }, status: 413 }, ok).kind).toBe('too-large');
    expect(classifyRpc({ data: null, error: { code: '' }, status: 0 }, ok).kind).toBe('error');
    expect(classifyRpc({ data: null, error: { code: 'PGRST301' }, status: 401 }, ok).kind).toBe('error');
    expect(classifyRpc({ data: null, error: { code: '' }, status: 503 }, ok).kind).toBe('error');
    expect(classifyRpc({ data: {}, error: null, status: 200 }, ok).kind).toBe('ok');
  });
});

describe('what Settings says', () => {
  it('names where the save is in each phase', () => {
    const now = new Date(2026, 9, 23, 15, 0);
    const today = new Date(2026, 9, 23, 14, 2).getTime();
    const earlier = new Date(2026, 9, 20, 9, 30).getTime();
    expect(describeSaveStatus({ phase: 'saved', savedAt: today }, now))
      .toBe(`Saved to your account · ${new Date(today).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}`);
    expect(describeSaveStatus({ phase: 'saved', savedAt: earlier }, now)).toMatch(/^Saved to your account · .+, .+/);
    expect(describeSaveStatus({ phase: 'pending' }, now)).toBe('Saving…');
    expect(describeSaveStatus({ phase: 'saving' }, now)).toBe('Saving…');
    expect(describeSaveStatus({ phase: 'offline' }, now)).toBe('Couldn’t reach the server — saved on this device, will retry');
    expect(describeSaveStatus({ phase: 'unavailable' }, now)).toBe('Saved on this device only');
    expect(describeSaveStatus({ phase: 'too-large' }, now)).toMatch(/^Saved on this device only/);
  });
});

describe('signing in', () => {
  it('sends this device\'s save when the account has none', async () => {
    useGameStore.setState({ ownerUserId: A, level: 3, coins: 900 });
    const { out, settled } = await signIn(A);
    expect(out).toBe('pushed');
    expect(server.rows.get(A).rev).toBe(1);
    expect(saveHash(server.rows.get(A).save)).toBe(saveHash(payloadNow()));
    expect(get().cloudRev).toBe(1);
    expect(phase()).toBe('saved');
    expect(settled).toEqual(['pushed']);
  });

  it('takes the account\'s save on a new device, with its gem mark: no gem is credited twice', async () => {
    // The phone bought 500 gems (mark 500) and has 210 left after spending.
    server.write(A, played({ gems: 210, lastSyncedServerGems: 500 }));
    // A fresh browser: the reconcile alone would see 500 - 0 and credit all of it again.
    const { out, settled } = await signIn(A, { balance: 500 });
    expect(out).toBe('adopted');
    expect(settled).toEqual(['adopted']);
    expect(get().level).toBe(7);
    expect(get().playerName).toBe('Phone Bear');
    expect(get().lastSyncedServerGems).toBe(500);
    expect(get().gems).toBe(210);
    expect(toasts.at(-1).title).toBe('Save loaded from your account');
    // Nothing to send back: the device is in step.
    await vi.advanceTimersByTimeAsync(PUSH_DEBOUNCE_MS * 2);
    expect(server.puts()).toHaveLength(0);
  });

  it('still credits a purchase the account\'s save has not counted yet', async () => {
    server.write(A, played({ gems: 210, lastSyncedServerGems: 500 }));
    await signIn(A, { balance: 800 }); // 300 more bought since that save was sent
    expect(get().gems).toBe(510);
    expect(get().lastSyncedServerGems).toBe(800);
  });

  it('keeps this device\'s settings when it takes the account\'s save', async () => {
    useGameStore.setState({ soundEnabled: false, animationsEnabled: false });
    server.write(A, played({ soundEnabled: true, animationsEnabled: true }));
    await signIn(A);
    expect(get().soundEnabled).toBe(false);
    expect(get().animationsEnabled).toBe(false);
  });

  it('takes the account\'s save when this device has not changed since its last sync', async () => {
    useGameStore.setState({ ownerUserId: A, level: 2 });
    await signIn(A);                    // rev 1: this device's save
    stopCloudSync();
    server.write(A, played({ level: 11 })); // rev 2: another device played on
    toasts.length = 0;
    const { out } = await signIn(A);
    expect(out).toBe('adopted');
    expect(get().level).toBe(11);
    expect(readBackup(A)).toBeNull();   // nothing of this device's was lost, so no backup
  });

  it('when both moved, keeps the save with more progress and backs up the other, saying so', async () => {
    useGameStore.setState({ ownerUserId: A, level: 2 });
    await signIn(A);
    stopCloudSync();
    server.write(A, played({ level: 12 }));     // the other device, far ahead
    useGameStore.setState({ level: 3, coins: 777 }); // this device moved too, a little
    const { out } = await signIn(A);
    expect(out).toBe('adopted');
    expect(get().level).toBe(12);
    const backup = readBackup(A);
    expect(backup.save.level).toBe(3);
    expect(backup.save.coins).toBe(777);
    expect(useCloudSave.getState().backup).toMatchObject({ level: 3 });
    expect(toasts.at(-1).title).toBe('Two saves didn’t match');
    expect(toasts.at(-1).description).toContain('Level 12');
  });

  it('when this device is further ahead, sends it over the account\'s and backs that one up', async () => {
    useGameStore.setState({ ownerUserId: A, level: 2 });
    await signIn(A);
    stopCloudSync();
    server.write(A, played({ level: 4, totalBattles: 1, ownedCards: [1, 2, 3, 4, 5, 6, 30, 31, 40, 41, 42] }));
    useGameStore.setState({ level: 20, totalBattles: 200 });
    const { out } = await signIn(A);
    expect(out).toBe('pushed');
    expect(server.rows.get(A).rev).toBe(3);
    expect(server.rows.get(A).save.level).toBe(20);
    expect(readBackup(A).save.level).toBe(4);
    expect(server.puts().at(-1).base).toBe(2);
  });

  it('sends a reset to the account instead of taking the pre-reset save back', async () => {
    useGameStore.setState({ ownerUserId: A, level: 9, totalBattles: 80, gems: 3000, lastSyncedServerGems: 3000 });
    await signIn(A);
    get().resetProgress();
    await vi.advanceTimersByTimeAsync(PUSH_DEBOUNCE_MS);
    const row = server.rows.get(A);
    expect(row.rev).toBe(2);
    expect(row.save.level).toBe(1);
    expect(row.save.gems).toBe(3000);          // kept through the reset
    expect(row.save.lastSyncedServerGems).toBe(3000);
    // And a later sign-in leaves it reset.
    stopCloudSync();
    await signIn(A);
    expect(get().level).toBe(1);
  });

  it('never discards a never-synced wiped save that still holds paid items', async () => {
    // A save from before cloud saves, reset after buying: no progress, but
    // 3,000 gems and a Legendary pack it kept. Not an empty save to replace.
    useGameStore.setState({ ownerUserId: A, gems: 3000, lastSyncedServerGems: 3000, legendaryPacks: 1, level: 9 });
    get().resetProgress();
    expect(get().cloudSyncedHash).toBeNull();
    server.write(A, played({ level: 10, totalBattles: 90 }));
    const { out } = await signIn(A);
    expect(out).toBe('adopted');
    expect(readBackup(A).save).toMatchObject({ gems: 3000, legendaryPacks: 1 });
    expect(toasts.at(-1).title).toBe('Two saves didn’t match');
  });

  it('never undoes a reset without a word: the account moved on, so the reset save is kept and the player told', async () => {
    useGameStore.setState({ ownerUserId: A, level: 9, totalBattles: 80 });
    await signIn(A);
    stopCloudSync();
    server.write(A, played({ level: 10, totalBattles: 90 })); // another device played on
    get().resetProgress();                                      // this device reset, offline
    toasts.length = 0;
    const { out } = await signIn(A);
    expect(out).toBe('adopted');
    expect(readBackup(A).save.level).toBe(1);
    expect(toasts.at(-1).title).toBe('Two saves didn’t match');
  });

  it('keeps a reset save holding paid items as the backup when the account moved on', async () => {
    useGameStore.setState({ ownerUserId: A, level: 9, totalBattles: 80, gems: 3000, lastSyncedServerGems: 3000 });
    await signIn(A);
    stopCloudSync();
    server.write(A, played({ level: 10, totalBattles: 90 })); // another device played on
    get().resetProgress();                                      // offline, this device reset
    const { out } = await signIn(A);
    expect(out).toBe('adopted');
    expect(readBackup(A).save.gems).toBe(3000);                 // not thrown away as "empty"
  });
});

describe('the calendar\'s own changes', () => {
  // The menu rolls the save over to today on mount (MainMenu: syncSeason in a
  // layout effect, then syncPeriods), before the cloud save's chunk has even
  // loaded, so by the time a decision reads the store a device that has done
  // nothing since its last sync no longer holds the save it synced.
  const openMenu = () => {
    get().syncSeason();
    get().syncPeriods();
  };
  const day1 = new Date(2026, 8, 30, 20, 0);   // Wed 30 Sep: the last day of Season 2
  const day2 = new Date(2026, 9, 1, 9, 0);     // Thu 1 Oct: Season 3, a new day, the same week

  // Yesterday: this device in step with the account at rev 1, a day's
  // challenge counters on it, and the season stamped.
  const syncedYesterday = async (over = {}) => {
    vi.setSystemTime(day1);
    useGameStore.setState({ ownerUserId: A, level: 6, totalBattles: 20, todayWins: 3, todayBattles: 4, ...over });
    openMenu();
    await signIn(A);
    stopCloudSync();
    expect(server.rows.get(A).rev).toBe(1);
    vi.setSystemTime(day2);
  };

  it('a new day here is not a change: a device that is only behind takes the account\'s save, with no conflict', async () => {
    await syncedYesterday();
    // The phone opened today and played on (rev 2).
    server.write(A, { ...server.rows.get(A).save, ...stampedToday(), todayWins: 0, todayBattles: 0, level: 8, totalBattles: 30 });
    openMenu();
    expect(get().todayWins).toBe(0); // the rollover did write to this device's save
    toasts.length = 0;
    const { out } = await signIn(A);
    expect(out).toBe('adopted');
    expect(get().level).toBe(8);
    expect(readBackup(A)).toBeNull();
    expect(toasts.map((t) => t.title)).toEqual(['Save loaded from your account']);
  });

  it('…nor, on a progress tie, does its old save go over the account\'s', async () => {
    await syncedYesterday({ gems: 210, lastSyncedServerGems: 500 });
    // The phone spent its gems on three Premium packs and took a new name:
    // no progress either way, so a "both moved" tie would keep this device's.
    server.write(A, { ...server.rows.get(A).save, ...stampedToday(), todayWins: 0, todayBattles: 0, gems: 0, premiumPacks: 3, playerName: 'Renamed Bear' });
    openMenu();
    const { out } = await signIn(A);
    expect(out).toBe('adopted');
    expect([get().gems, get().premiumPacks, get().playerName]).toEqual([0, 3, 'Renamed Bear']);
    await vi.advanceTimersByTimeAsync(PUSH_DEBOUNCE_MS * 2);
    expect(server.puts().slice(1)).toHaveLength(0); // nothing sent over it
    expect(server.rows.get(A).save.premiumPacks).toBe(3);
  });

  it('a new season here, with the tiers it owed delivered, is not a change either', async () => {
    // Season 2's pass, Premium, 1,500 XP in and nothing claimed: its end
    // delivers cards, coins, gems, packs and a border on whichever device
    // opens first.
    await syncedYesterday({ seasonKey: 'season-2', seasonXP: 1500, hasBattlePassPremium: true });
    expect(get().seasonKey).toBe('season-2');
    server.write(A, { ...server.rows.get(A).save, ...stampedToday(), level: 9, totalBattles: 40, seasonXP: 0, hasBattlePassPremium: false });
    const gemsBefore = get().gems;
    openMenu();
    expect(get().seasonKey).toBe('season-3');
    expect(get().gems).toBeGreaterThan(gemsBefore); // delivered here
    const { out } = await signIn(A);
    expect(out).toBe('adopted');
    expect(get().level).toBe(9);
    expect(readBackup(A)).toBeNull();
  });

  it('a change of the player\'s own on top of the new day is still one: both moved', async () => {
    await syncedYesterday();
    server.write(A, { ...server.rows.get(A).save, ...stampedToday(), level: 12, totalBattles: 120 });
    openMenu();
    const rolled = get().coins;
    get().addCoins(500); // the daily reward, claimed before the account answered
    const { out } = await signIn(A);
    expect(out).toBe('adopted');
    expect(readBackup(A).save.coins).toBe(rolled + 500);
    expect(toasts.at(-1).title).toBe('Two saves didn’t match');
  });

  it('brings an account save from an earlier day up to today when it takes it, and sends that back', async () => {
    vi.setSystemTime(day1);
    const yesterday = played({ ...stampedToday(), todayWins: 9, todayBattles: 20, claimedChallenges: ['d-yesterday'] });
    vi.setSystemTime(day2);
    server.write(A, yesterday);
    const { out } = await signIn(A);
    expect(out).toBe('adopted');
    // Yesterday's nine wins no longer count towards today's challenges.
    expect([get().todayWins, get().todayBattles, get().dailyStatsDate]).toEqual([0, 0, day2.toDateString()]);
    expect(get().claimedChallenges).toEqual([]);
    expect(get().seasonKey).toBe('season-3');
    expect(phase()).toBe('pending');
    await vi.advanceTimersByTimeAsync(PUSH_DEBOUNCE_MS);
    expect(server.puts().map((p) => p.base)).toEqual([1]);
    expect(server.rows.get(A).save.todayWins).toBe(0);
    expect(phase()).toBe('saved');
  });

  it('a day rolled over by Challenges alone, while the game sat open, is not a change either', async () => {
    await syncedYesterday();
    await signIn(A); // the game is open from yesterday: in step at rev 1
    server.write(A, { ...server.rows.get(A).save, ...stampedToday(), todayWins: 0, todayBattles: 0, level: 8 });
    toasts.length = 0;
    // This morning, Challenges opens first (it rolls only the day) and then
    // the tab is left and come back to: its rollover is sent, refused (the
    // phone wrote rev 2), and decided again.
    get().syncPeriods();
    await vi.advanceTimersByTimeAsync(PUSH_DEBOUNCE_MS);
    expect(get().level).toBe(8);
    expect(readBackup(A)).toBeNull();
    expect(toasts.map((t) => t.title)).toEqual(['Save loaded from your account']);
  });

  it('works the rollover out on a scratch copy: the save in play and the stored one are untouched', () => {
    vi.setSystemTime(day2);
    useGameStore.setState({ ownerUserId: A, level: 4, seasonKey: 'season-2', seasonXP: 300, dailyStatsDate: day1.toDateString(), todayWins: 5 });
    const stored = localStorage.getItem(STORAGE_KEY);
    const before = payloadNow();
    const rolled = rollForward(before);
    expect([rolled.seasonKey, rolled.seasonXP, rolled.todayWins]).toEqual(['season-3', 0, 0]);
    expect(rolled.coins).toBeGreaterThan(before.coins); // what Season 2 still owed
    expect(payloadNow()).toEqual(before);
    expect(get().pendingSeasonDeliveries).toEqual([]);
    expect(localStorage.getItem(STORAGE_KEY)).toBe(stored);
  });

  it('believes its record of the synced save only while it is that save', async () => {
    await syncedYesterday();
    const key = `terrible-teddies-cloud-synced:${A}`;
    const record = JSON.parse(localStorage.getItem(key));
    expect(record.hash).toBe(get().cloudSyncedHash);
    expect(lastSyncedSave(A, get().cloudSyncedHash)).toEqual(record.save);
    // A record that is not the save under that fingerprint (another tab's,
    // half-written), or a fingerprint it is not for: not believed, so the
    // decision falls back to "both moved" rather than taking a guess.
    localStorage.setItem(key, JSON.stringify({ ...record, save: { ...record.save, coins: 1 } }));
    expect(lastSyncedSave(A, get().cloudSyncedHash)).toBeNull();
    localStorage.setItem(key, JSON.stringify(record));
    expect(lastSyncedSave(A, 'another-save')).toBeNull();
    expect(lastSyncedSave(B, get().cloudSyncedHash)).toBeNull();
  });

  it('brings the backup up to today when the player switches to it', async () => {
    await syncedYesterday({ level: 3, coins: 777 });
    server.write(A, { ...server.rows.get(A).save, ...stampedToday(), level: 12, totalBattles: 120 });
    useGameStore.setState({ coins: 778 }); // moved here too: the next sign-in keeps a backup
    await signIn(A);
    expect(readBackup(A).save.dailyStatsDate).toBe(day1.toDateString());
    switchToBackupSave();
    // Its 778 coins, plus what Season 2 still owed it (tier 1 opens at 0 XP).
    expect(get().coins).toBe(778 + BATTLE_PASS_REWARDS[0].free.amount);
    expect([get().todayWins, get().dailyStatsDate, get().seasonKey]).toEqual([0, day2.toDateString(), 'season-3']);
  });
});

describe('a refused write', () => {
  it('in the middle of a decision, decides again and still settles and tells the player once', async () => {
    const starter = [1, 2, 3, 4, 5, 6, 30, 31, 40, 41, 42];
    useGameStore.setState({ ownerUserId: A, level: 20, totalBattles: 200 });
    server.write(A, played({ level: 4, totalBattles: 1, ownedCards: starter }));
    // Between this device's read and its write, another device sends rev 2.
    server.afterGet = () => server.write(A, played({ level: 5, totalBattles: 2, ownedCards: starter }));
    const { out, settled } = await signIn(A);
    expect(out).toBe('pushed');
    expect(server.puts().map((p) => p.base)).toEqual([1, 2]);
    expect(server.rows.get(A).save.level).toBe(20);
    expect(readBackup(A).save.level).toBe(5); // the newest of the two it replaced
    expect(settled).toEqual(['pushed']);
    expect(toasts).toHaveLength(1);
  });

  it('re-reads and decides again: the account moved on, this device has more → sent on top, other backed up', async () => {
    useGameStore.setState({ ownerUserId: A, level: 5, totalBattles: 40 });
    await signIn(A);
    server.write(A, played({ level: 2, totalBattles: 2, ownedCards: [1, 2, 3, 4, 5, 6, 30, 31, 40, 41, 42] }));
    get().recordBattleResult(true);
    await vi.advanceTimersByTimeAsync(PUSH_DEBOUNCE_MS);
    const puts = server.puts();
    expect(puts.map((p) => p.base)).toEqual([0, 1, 2]); // first save, refused at 1, sent at 2
    expect(server.rows.get(A).rev).toBe(3);
    expect(server.rows.get(A).save.totalBattles).toBe(41);
    expect(readBackup(A).save.level).toBe(2);
  });

  it('a refusal over a save this device sent itself is no conflict: no backup, no toast', async () => {
    useGameStore.setState({ ownerUserId: A, level: 5 });
    await signIn(A);
    toasts.length = 0;
    // The tab is hidden with a change: the keepalive lands, its answer is lost.
    get().addCoins(10);
    server.mode = 'lose-answer';
    setVisibility('hidden');
    await vi.advanceTimersByTimeAsync(0);
    expect(server.rows.get(A).rev).toBe(2);
    expect(get().cloudRev).toBe(1);   // this device never heard
    server.mode = 'ok';
    setVisibility('visible');
    await vi.advanceTimersByTimeAsync(0);
    get().addCoins(5);
    await vi.advanceTimersByTimeAsync(PUSH_DEBOUNCE_MS);
    expect(server.rows.get(A).save.coins).toBe(get().coins);
    expect(readBackup(A)).toBeNull();
    expect(toasts).toHaveLength(0);
  });
});

describe('sending changes', () => {
  it('waits for a few quiet seconds and sends once', async () => {
    useGameStore.setState({ ownerUserId: A });
    await signIn(A);
    server.calls = [];
    get().addCoins(1);
    expect(phase()).toBe('pending');
    await vi.advanceTimersByTimeAsync(PUSH_DEBOUNCE_MS - 500);
    get().addCoins(1);
    await vi.advanceTimersByTimeAsync(PUSH_DEBOUNCE_MS - 500);
    expect(server.puts()).toHaveLength(0);
    await vi.advanceTimersByTimeAsync(500);
    expect(server.puts()).toHaveLength(1);
    expect(server.rows.get(A).save.coins).toBe(get().coins);
    expect(phase()).toBe('saved');
  });

  it('ignores changes to this device\'s own settings', async () => {
    useGameStore.setState({ ownerUserId: A });
    await signIn(A);
    server.calls = [];
    get().setSoundEnabled(false);
    await vi.advanceTimersByTimeAsync(PUSH_DEBOUNCE_MS * 2);
    expect(server.calls).toHaveLength(0);
  });

  it('sends at once, as a keepalive, when the tab is hidden', async () => {
    useGameStore.setState({ ownerUserId: A });
    await signIn(A);
    get().addCoins(25);
    setVisibility('hidden');
    await vi.advanceTimersByTimeAsync(0);
    const last = server.puts().at(-1);
    expect(last.keepalive).toBe(true);
    expect(last.token).toBe(`token-${A}`);
    expect(server.rows.get(A).save.coins).toBe(get().coins);
    // pagehide right after: already sent, so nothing more goes.
    window.dispatchEvent(new Event('pagehide'));
    await vi.advanceTimersByTimeAsync(PUSH_DEBOUNCE_MS);
    expect(server.puts()).toHaveLength(2);
  });

  // GameBoard's pagehide listener, which books an abandoned battle as a loss.
  // Registered after the cloud save's, as GameBoard mounts after sign-in.
  let detachBoard = null;
  const abandonOnPageHide = () => {
    const book = () => get().recordBattleResult(false);
    window.addEventListener('pagehide', book);
    detachBoard = () => window.removeEventListener('pagehide', book);
  };
  afterEach(() => {
    detachBoard?.();
    detachBoard = null;
  });

  it('holds the send through a battle until its result, then sends the result', async () => {
    useGameStore.setState({ ownerUserId: A });
    await signIn(A);
    get().addCoins(5); // a change waiting when the battle starts
    document.documentElement.dataset.screen = 'battle';
    // Switched away first, closed later: hidden, then pagehide.
    setVisibility('hidden');
    window.dispatchEvent(new Event('pagehide'));
    await vi.advanceTimersByTimeAsync(0);
    expect(server.puts()).toHaveLength(1); // only the first save from sign-in
    // GameBoard's pagehide listener books the abandoned battle as a loss.
    get().recordBattleResult(false);
    await vi.advanceTimersByTimeAsync(0);
    const last = server.puts().at(-1);
    expect(last.keepalive).toBe(true);
    expect(server.rows.get(A).save.totalLosses).toBe(1);
    expect(server.rows.get(A).save.coins).toBe(get().coins);
  });

  it('a reload or close of the tab in front, mid-battle, still sends the abandoned battle\'s loss', async () => {
    useGameStore.setState({ ownerUserId: A });
    await signIn(A);
    get().addCoins(5);
    document.documentElement.dataset.screen = 'battle';
    abandonOnPageHide();
    // The browser's own order on the way out: pagehide while still visible
    // (GameBoard books the loss in its listener, after ours), then hidden.
    window.dispatchEvent(new Event('pagehide'));
    await vi.advanceTimersByTimeAsync(0);
    expect(server.puts()).toHaveLength(2);
    const last = server.puts().at(-1);
    expect(last.keepalive).toBe(true);
    expect(last.save.totalLosses).toBe(1);
    expect(server.rows.get(A).save.coins).toBe(get().coins);
    setVisibility('hidden');
    await vi.advanceTimersByTimeAsync(PUSH_DEBOUNCE_MS);
    expect(server.puts()).toHaveLength(2); // sent once, the whole result in it
    expect(server.rows.get(A).save).toMatchObject({ totalLosses: 1, totalBattles: 1, xp: get().xp, coins: get().coins });
  });

  it('…and sends what was waiting, once hidden, when there was no result to book', async () => {
    useGameStore.setState({ ownerUserId: A });
    await signIn(A);
    get().addCoins(5);
    document.documentElement.dataset.screen = 'battle'; // a board with no battle joined yet
    window.dispatchEvent(new Event('pagehide'));
    await vi.advanceTimersByTimeAsync(0);
    expect(server.puts()).toHaveLength(1); // held for a result that may follow
    setVisibility('hidden'); // after every pagehide listener: nothing more is coming
    await vi.advanceTimersByTimeAsync(0);
    expect(server.puts()).toHaveLength(2);
    expect(server.puts().at(-1).keepalive).toBe(true);
    expect(server.rows.get(A).save.coins).toBe(get().coins);
  });

  it('a plain send still out when the page goes does not keep the keepalive one back', async () => {
    useGameStore.setState({ ownerUserId: A });
    await signIn(A);
    get().addCoins(7);
    server.gate = new Promise(() => {}); // unloading cancels it: it never lands
    await vi.advanceTimersByTimeAsync(PUSH_DEBOUNCE_MS);
    expect(phase()).toBe('saving');
    window.dispatchEvent(new Event('pagehide'));
    await vi.advanceTimersByTimeAsync(0);
    const last = server.puts().at(-1);
    expect(last.keepalive).toBe(true);
    expect(server.rows.get(A).save.coins).toBe(get().coins);
  });

  it('a page back from the back/forward cache waits its few seconds again', async () => {
    useGameStore.setState({ ownerUserId: A });
    await signIn(A);
    window.dispatchEvent(new Event('pagehide'));
    window.dispatchEvent(new Event('pageshow'));
    get().addCoins(1);
    await vi.advanceTimersByTimeAsync(0);
    expect(server.puts()).toHaveLength(1);
    expect(phase()).toBe('pending');
    await vi.advanceTimersByTimeAsync(PUSH_DEBOUNCE_MS);
    expect(server.puts()).toHaveLength(2);
    expect(server.puts().at(-1).keepalive).toBeUndefined();
  });

  it('retries a failed send, backing off, and says so meanwhile', async () => {
    // No jitter: with it, the second retry (4 s ± 20%) could land inside the
    // 2.5 s this checks it waits past the first (2 s ± 20%), now and then.
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    useGameStore.setState({ ownerUserId: A });
    await signIn(A);
    server.mode = 'offline';
    get().addCoins(3);
    await vi.advanceTimersByTimeAsync(PUSH_DEBOUNCE_MS);
    expect(phase()).toBe('offline');
    const failed = server.puts().length;
    await vi.advanceTimersByTimeAsync(RETRY_BASE_MS * 1.25);
    expect(server.puts().length).toBe(failed + 1);   // first retry ~2s
    await vi.advanceTimersByTimeAsync(RETRY_BASE_MS * 1.25);
    expect(server.puts().length).toBe(failed + 1);   // the next waits ~4s
    await vi.advanceTimersByTimeAsync(RETRY_BASE_MS * 2);
    expect(server.puts().length).toBe(failed + 2);
    server.mode = 'ok';
    await vi.advanceTimersByTimeAsync(RETRY_BASE_MS * 5);
    expect(phase()).toBe('saved');
    expect(server.rows.get(A).save.coins).toBe(get().coins);
  });

  it('saveNow sends a waiting change straight away (Sign Out)', async () => {
    useGameStore.setState({ ownerUserId: A });
    await signIn(A);
    get().addCoins(9);
    expect(await saveNow()).toBe('pushed');
    expect(server.rows.get(A).save.coins).toBe(get().coins);
  });

  it('does not send a save over the size cap, and says it stays on this device', async () => {
    useGameStore.setState({ ownerUserId: A });
    await signIn(A);
    server.calls = [];
    get().saveDeck('x'.repeat(CLOUD_SAVE_MAX_BYTES), [1]);
    await vi.advanceTimersByTimeAsync(PUSH_DEBOUNCE_MS);
    expect(server.calls).toHaveLength(0);
    expect(phase()).toBe('too-large');
  });
});

describe('a backend without cloud saves', () => {
  for (const [mode, why] of [['missing', 'the functions are not there (404)'], ['null', 'an answer it does not recognise']]) {
    it(`changes nothing and stops, when ${why}`, async () => {
      server.mode = mode;
      useGameStore.setState({ ownerUserId: A, level: 4, coins: 1234 });
      const before = JSON.stringify(payloadNow());
      const { out, settled } = await signIn(A, { balance: null });
      expect(out).toBe('unavailable');
      expect(settled).toEqual(['unavailable']); // the gem reconcile still runs, as it always did
      expect(phase()).toBe('unavailable');
      expect(JSON.stringify(payloadNow())).toBe(before);
      expect(get().cloudRev).toBe(0);
      server.calls = [];
      get().addCoins(10);
      setVisibility('hidden');
      setVisibility('visible');
      await vi.advanceTimersByTimeAsync(RECHECK_MIN_MS * 2);
      expect(server.calls).toHaveLength(0);
    });
  }

  it('still reconciles gems on every later session change, as it did before cloud saves', async () => {
    server.mode = 'missing';
    useGameStore.setState({ ownerUserId: A });
    let balance = 100;
    const onSettled = () => get().reconcileServerGems(balance, A);
    bindSaveToUser(A);
    await startCloudSync({ userId: A, accessToken: 't1', onSettled });
    expect(get().gems).toBe(110);
    balance = 150; // bought on another device while this tab is open
    // supabase-js hands App a new session (a token refresh, a return to the tab).
    await startCloudSync({ userId: A, accessToken: 't2', onSettled });
    expect(get().gems).toBe(160);
    expect(server.calls.filter((c) => c.fn === 'get')).toHaveLength(1); // and asks the backend nothing
  });

  it('does not reconcile gems before a decision it could not make (offline at sign-in)', async () => {
    server.write(A, played({ gems: 210, lastSyncedServerGems: 500 }));
    server.mode = 'offline';
    const { out, settled } = await signIn(A, { balance: 500 });
    expect(out).toBe('offline');
    expect(settled).toEqual([]);          // a reconcile now would credit all 500 again
    expect(get().gems).toBe(10);
    server.mode = 'ok';
    await vi.advanceTimersByTimeAsync(RETRY_BASE_MS * 1.25);
    expect(settled).toEqual(['adopted']);
    expect(get().gems).toBe(210);
  });
});

describe('two tabs', () => {
  it('re-reads this device\'s save before deciding', async () => {
    useGameStore.setState({ ownerUserId: A, level: 2 });
    // The other tab, meanwhile, played on and wrote its save.
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      state: { ...useGameStore.getInitialState(), ownerUserId: A, level: 6, totalBattles: 25 },
      version: 3,
    }));
    await signIn(A);
    expect(server.rows.get(A).save.level).toBe(6);
  });
});

describe('another account on this device', () => {
  it('parks the save it replaces, and gives it back when its account returns', async () => {
    useGameStore.setState({ ownerUserId: A, level: 8, coins: 4000 }); // never reached the account
    server.mode = 'offline';
    bindSaveToUser(B);
    expect(get().ownerUserId).toBe(B);
    expect(get().level).toBe(1);   // B does not inherit A's save
    useGameStore.setState({ level: 2 });
    bindSaveToUser(A);
    expect(get().ownerUserId).toBe(A);
    expect(get().level).toBe(8);
    expect(get().coins).toBe(4000);
  });

  it('parks nothing for a save its account already has, and never sends the wiped one over it', async () => {
    useGameStore.setState({ ownerUserId: A, level: 8 });
    await signIn(A);
    stopCloudSync();
    bindSaveToUser(B);
    bindSaveToUser(A);
    expect(get().level).toBe(1); // wiped; the account's copy comes back at sign-in
    // This device once sent the account's save, but the save in the store
    // now did not grow from it: taking it back is right, sending over it
    // would erase the account.
    await signIn(A);
    expect(get().level).toBe(8);
    expect(server.rows.get(A).rev).toBe(1);
    expect(server.puts()).toHaveLength(1);
  });
});

describe('the backup', () => {
  it('switching swaps the two saves, sends the switched-to one, and reconciles against its mark', async () => {
    useGameStore.setState({ ownerUserId: A, level: 2 });
    await signIn(A);
    stopCloudSync();
    server.write(A, played({ level: 12 }));
    useGameStore.setState({ level: 3, coins: 777 });
    const { settled } = await signIn(A);
    expect(get().level).toBe(12);

    expect(switchToBackupSave()).toBe(true);
    expect(get().level).toBe(3);
    expect(get().coins).toBe(777);
    expect(readBackup(A).save.level).toBe(12); // the other way round now
    expect(settled.at(-1)).toBe('switched');
    await vi.advanceTimersByTimeAsync(0);
    expect(server.rows.get(A).save.level).toBe(3);
  });

  it('there is nothing to switch to without one', () => {
    useGameStore.setState({ ownerUserId: A });
    expect(switchToBackupSave()).toBe(false);
  });
});
