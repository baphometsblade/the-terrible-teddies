import { beforeEach, describe, it, expect } from 'vitest';
import { useGameStore } from '../stores/gameStore';

const get = () => useGameStore.getState();
const STORAGE_KEY = 'terrible-teddies-storage';

// Stand in for "the other tab wrote this": the persist middleware serialises
// the whole partialized state under one device-wide key, so another tab's save
// is just a different blob at that key.
const otherTabSaves = (state) =>
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ state, version: 3 }));

beforeEach(() => {
  localStorage.clear();
  get().resetProgress();
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
