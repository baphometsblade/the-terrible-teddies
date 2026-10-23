import { beforeEach, describe, it, expect, vi } from 'vitest';
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { useGameStore } from '../stores/gameStore';

// What the hook does after rehydrating, recorded with the coins it saw then.
const settled = [];
vi.mock('./settlePendingPurchase', () => ({
  settlePendingPurchase: async () => { settled.push(useGameStore.getState().coins); return 'none'; },
}));
const { useRehydrateOnFocus } = await import('./useRehydrateOnFocus');

const get = () => useGameStore.getState();
const STORAGE_KEY = 'terrible-teddies-storage';

// Stand in for "the other tab wrote this": the persist middleware serialises
// the whole partialized state under one device-wide key, so another tab's save
// is just a different blob at that key.
const otherTabSaves = (state) =>
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ state, version: 3 }));

beforeEach(() => {
  localStorage.clear();
  // A clean store: resetProgress now keeps paid items, so it is no clean slate.
  useGameStore.setState(useGameStore.getInitialState(), true);
  settled.length = 0;
});

describe('a return to the tab', () => {
  // A payment left pending is settled on the way back in, after the save is
  // re-read: settled first, its reconcile would be overwritten by the rehydrate.
  it('settles a pending purchase after rehydrating, not before', async () => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    const host = document.createElement('div');
    const root = createRoot(host);
    const Probe = () => { useRehydrateOnFocus(); return null; };
    act(() => root.render(createElement(Probe)));

    otherTabSaves({ coins: 4242 });
    await act(async () => { window.dispatchEvent(new Event('focus')); });
    expect(settled).toEqual([4242]);

    // Hiding the tab is not a return.
    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
    await act(async () => { document.dispatchEvent(new Event('visibilitychange')); });
    expect(settled).toHaveLength(1);
    delete document.visibilityState;

    act(() => root.unmount());
  });
});

describe('rehydrating picks up another tab\'s save', () => {
  it('reproduces the loss without a rehydrate, and prevents it with one', async () => {
    // This tab's in-memory snapshot.
    useGameStore.setState({ coins: 100, gems: 10, ownedCards: [1, 2] });

    // The other tab, meanwhile, earns a great deal and persists it.
    otherTabSaves({
      coins: 9000,
      gems: 500,
      ownedCards: [1, 2, 3, 4, 5, 6],
      level: 12,
      completedAchievements: ['first_win', 'big_spender'],
    });

    // Without rehydrating, this tab still believes its own stale numbers — and
    // its next write would serialise these over the other tab's save.
    expect(get().coins).toBe(100);
    expect(get().ownedCards).toHaveLength(2);

    await useGameStore.persist.rehydrate();

    // After rehydrating it holds the other tab's state, so the next write
    // carries that forward rather than reverting it.
    expect(get().coins).toBe(9000);
    expect(get().gems).toBe(500);
    expect(get().ownedCards).toHaveLength(6);
    expect(get().level).toBe(12);
    expect(get().completedAchievements).toContain('big_spender');
  });

  it('keeps the store usable: actions survive the rehydrate', async () => {
    // rehydrate replaces the state object, so this pins that the actions —
    // which live on that same object in zustand — are still callable after it.
    otherTabSaves({ coins: 500 });
    await useGameStore.persist.rehydrate();

    expect(typeof get().addCoins).toBe('function');
    get().addCoins(100);
    expect(get().coins).toBe(600);
  });

  it('does not resurrect state the other tab never saved', async () => {
    // pendingAchievements is deliberately not persisted (see partialize). A
    // rehydrate must not invent it, nor drop the queue this tab is holding.
    useGameStore.setState({ pendingAchievements: [{ id: 'in_flight' }] });
    otherTabSaves({ coins: 777 });
    await useGameStore.persist.rehydrate();

    expect(get().coins).toBe(777);
    expect(get().pendingAchievements).toEqual([{ id: 'in_flight' }]);
  });
});
