import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// whenFirstDecision: what App holds Daily Rewards and the first-run tutorial
// on, so they never open on the wiped save a new device starts with. Kept
// apart from cloudSave.test.js, whose server stub answers at once: here the
// account's answer is held back, as a real round-trip holds it.
const server = {
  answer: null,
  release: null,
  held: null,
  hold() {
    this.held = new Promise((resolve) => { this.release = resolve; });
  },
  reset() {
    this.answer = null;
    this.release = null;
    this.held = null;
  },
};

vi.mock('@/utils/supabaseClient', () => ({
  getPlayerSave: vi.fn(async () => {
    if (server.held) await server.held;
    return server.answer;
  }),
  putPlayerSave: vi.fn(async () => ({ data: { ok: true, rev: 1, updated_at: null }, error: null, status: 200 })),
  putPlayerSaveKeepalive: vi.fn(async () => ({ data: { ok: true, rev: 1, updated_at: null }, error: null, status: 200 })),
}));
vi.mock('@/components/ui/use-toast', () => ({ toast: () => {} }));

const { startCloudSync, stopCloudSync, whenFirstDecision, bindSaveToUser, cloudPayload } = await import('./cloudSave');
const { useGameStore } = await import('@/stores/gameStore');

const A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

// The account's save, well into the game, as another device sent it.
const accountSave = () => cloudPayload({
  ...useGameStore.getInitialState(),
  level: 7, xp: 40, totalBattles: 30, totalWins: 20, tutorialCompleted: true,
});
const ok = (save) => ({ data: { rev: 5, save, updated_at: new Date().toISOString() }, error: null, status: 200 });

// Whether `promise` has settled yet, without waiting for it.
const settledYet = async (promise) => {
  let done = false;
  promise.then(() => { done = true; });
  await new Promise((r) => setTimeout(r, 0));
  return done;
};

beforeEach(() => {
  localStorage.clear();
  useGameStore.setState(useGameStore.getInitialState(), true);
  server.reset();
});
afterEach(() => {
  server.release?.();
  stopCloudSync();
});

describe('whenFirstDecision', () => {
  it('waits for the account\'s answer, and resolves once its save is in', async () => {
    server.answer = ok(accountSave());
    server.hold();
    bindSaveToUser(A);
    startCloudSync({ userId: A, accessToken: 't1' });
    const first = whenFirstDecision(A);
    expect(await settledYet(first)).toBe(false);
    // A token refresh while it is out answers 'recent' at once: that must
    // not be taken for the decision.
    expect(await startCloudSync({ userId: A, accessToken: 't2' })).toBe('recent');
    expect(whenFirstDecision(A)).toBe(first);
    expect(await settledYet(first)).toBe(false);
    expect(useGameStore.getState().level).toBe(1);
    server.release();
    expect(await first).toBe('adopted');
    expect(useGameStore.getState()).toMatchObject({ level: 7, tutorialCompleted: true });
  });

  // An unreachable backend must never hold the game up.
  it('resolves when the account cannot be reached', async () => {
    server.answer = { data: null, error: { code: '', message: 'TypeError: Failed to fetch' }, status: 0 };
    bindSaveToUser(A);
    startCloudSync({ userId: A });
    expect(await whenFirstDecision(A)).toBe('offline');
  });

  it('resolves on a backend without cloud saves', async () => {
    server.answer = { data: null, error: { code: 'PGRST202', message: 'Could not find the function public.get_player_save' }, status: 404 };
    bindSaveToUser(A);
    startCloudSync({ userId: A });
    expect(await whenFirstDecision(A)).toBe('unavailable');
  });

  it('resolves at once for an account this page is not syncing', async () => {
    expect(await whenFirstDecision(A)).toBe('none');
    server.answer = ok(accountSave());
    server.hold();
    bindSaveToUser(A);
    startCloudSync({ userId: A });
    expect(await settledYet(whenFirstDecision(B))).toBe(true);
    expect(await settledYet(whenFirstDecision(A))).toBe(false);
  });
});
