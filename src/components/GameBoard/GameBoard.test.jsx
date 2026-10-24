import { StrictMode, act, createRef } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// The board's sound and server sync are side effects this test has no use
// for (jsdom has no audio, and there is no backend).
vi.mock('@/utils/sounds', () => ({ playSound: () => {} }));
vi.mock('../../utils/supabaseClient', () => ({
  syncBattleResult: () => Promise.resolve(),
  syncPlayerLevel: () => Promise.resolve(),
}));
// jsdom has no canvas to throw confetti on; the tests only need to know it
// was asked for.
vi.mock('@/lib/celebrate', () => ({ celebrate: vi.fn() }));

import GameBoard from './GameBoard';
import { useGameStore } from '../../stores/gameStore';
import { celebrate } from '@/lib/celebrate';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let container;
let root;

// Rendered under StrictMode, as the app is in development: effects run,
// unmount and run again, which is what doubled the log's intro.
async function renderBoard(props) {
  const ref = createRef();
  await act(async () => {
    root.render(<StrictMode><GameBoard ref={ref} {...props} /></StrictMode>);
  });
  return ref;
}

const leaveTitle = () => document.getElementById('leave-battle-title')?.textContent ?? null;
// Lets a closing dialog finish its exit fade (AnimatePresence keeps it in the
// DOM until then).
const settle = () => act(() => new Promise((resolve) => { setTimeout(resolve, 400); }));
const button = (name) => [...container.querySelectorAll('button')].find((b) => b.textContent.trim() === name);

beforeEach(() => {
  localStorage.clear();
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
});

describe('GameBoard', () => {
  it('opens a game with its intro logged once, even when the deal runs twice', async () => {
    await renderBoard({ onBackToMenu: () => {} });
    const entries = [...container.querySelectorAll('[role="log"] > div')].map((e) => e.textContent);
    expect(entries.filter((e) => e.includes('slams his deck'))).toHaveLength(1);
    expect(entries.filter((e) => e === 'Your turn. Make it hurt.')).toHaveLength(1);
  });

  // Every rehydrate (each focus, each return to the tab) puts a newly parsed
  // currentDeck in the store, and the deal depended on it: one alt-tab
  // re-dealt the game in progress. A game is dealt once, from a snapshot; a
  // new deck or difficulty applies from the next deal.
  it('deals once per game: a store change mid-game reaches the next deal, not this one', async () => {
    useGameStore.setState(useGameStore.getInitialState(), true);
    useGameStore.setState({ difficulty: 'easy' });
    await renderBoard({ onBackToMenu: () => {} });
    const hand = () => [...container.querySelectorAll('[data-hand-id]')].map((el) => el.getAttribute('data-hand-id'));
    const intros = () => [...container.querySelectorAll('[role="log"] > div')]
      .map((e) => e.textContent).filter((e) => e.includes('slams his deck'));
    const dealt = hand();
    expect(intros()).toHaveLength(1);
    expect(intros()[0]).toContain('EASY');

    await act(async () => {
      useGameStore.setState({ currentDeck: [...useGameStore.getState().currentDeck], difficulty: 'hard' });
    });
    expect(hand()).toEqual(dealt);
    expect(intros()).toHaveLength(1);
    expect(intros()[0]).toContain('EASY');

    // Play Again deals at the new difficulty.
    await act(async () => container.querySelector('button[title="Concede"]').click());
    await act(async () => button('Concede — counts as a loss').click());
    await act(async () => button('Play Again').click());
    expect(intros()).toHaveLength(1);
    expect(intros()[0]).toContain('HARD');
  });

  it('exposes a stable requestLeave that asks while the game is live', async () => {
    const onBackToMenu = vi.fn();
    const ref = await renderBoard({ onBackToMenu });
    const requestLeave = ref.current.requestLeave;
    expect(typeof requestLeave).toBe('function');

    await act(async () => requestLeave());
    expect(leaveTitle()).toBe('Leave this battle?');
    expect(onBackToMenu).not.toHaveBeenCalled();
    // The same function after the re-render it caused, so a caller can hold it.
    expect(ref.current.requestLeave).toBe(requestLeave);

    await act(async () => button('Keep playing').click());
    await settle();
    expect(leaveTitle()).toBe(null);
    expect(onBackToMenu).not.toHaveBeenCalled();

    // Confirming from the menu path leaves.
    await act(async () => requestLeave());
    await act(async () => button('Concede — counts as a loss').click());
    expect(onBackToMenu).toHaveBeenCalledTimes(1);
  });

  it('leaves at once once the game is over', async () => {
    const onBackToMenu = vi.fn();
    const ref = await renderBoard({ onBackToMenu });
    // Concede asks the same question, then plays the defeat out on the board.
    await act(async () => container.querySelector('button[title="Concede"]').click());
    expect(leaveTitle()).toBe('Concede this battle?');
    await act(async () => button('Concede — counts as a loss').click());
    expect(container.querySelector('[role="dialog"][aria-label="Defeat"]')).not.toBeNull();
    expect(onBackToMenu).not.toHaveBeenCalled();

    await act(async () => ref.current.requestLeave());
    await settle();
    expect(leaveTitle()).toBe(null);
    expect(onBackToMenu).toHaveBeenCalledTimes(1);
  });
});

// The result panel used to show "+20 XP · +5" and nothing else, while a
// level-up quietly paid 100 x the new level in coins and a Battle Pass tier
// opened unannounced.
describe('GameBoard result panel', () => {
  const concede = async () => {
    await act(async () => container.querySelector('button[title="Concede"]').click());
    await act(async () => button('Concede — counts as a loss').click());
    return container.querySelector('[role="dialog"][aria-label="Defeat"]');
  };
  // Stamp the current season first: an unstamped save with season XP outside
  // Season 1 is legacy progress, and the first addXP would wipe it.
  const seed = (state) => {
    useGameStore.getState().syncSeason();
    useGameStore.setState(state);
  };

  beforeEach(() => {
    // A clean store, not resetProgress: a reset keeps gems, packs, the pass and
    // the claim ledgers, which would leak from one test into the next.
    useGameStore.setState(useGameStore.getInitialState(), true);
    celebrate.mockClear();
  });

  it('shows the XP bar, and no level-up when there was none', async () => {
    seed({ level: 1, xp: 10, seasonXP: 10 });
    await renderBoard({ onBackToMenu: () => {} });
    const panel = await concede();
    const bar = panel.querySelector('[role="progressbar"][aria-label^="Level"]');
    expect(bar.getAttribute('aria-label')).toBe('Level 1: 30 of 100 XP');
    expect(bar.getAttribute('aria-valuenow')).toBe('30');
    expect(panel.querySelector('[data-level-up]')).toBeNull();
    expect(panel.querySelector('[data-pass-tier]')).toBeNull();
    // The final figures are there for a screen reader from the start, not
    // the count-up's passing numbers.
    expect(panel.textContent).toContain('20 XP');
    expect(panel.textContent).toContain('5 coins');
  });

  it('announces a level-up with the coins it paid, and takes it off the toast queue', async () => {
    seed({ level: 1, xp: 95, seasonXP: 95 });
    await renderBoard({ onBackToMenu: () => {} });
    const panel = await concede();
    const row = panel.querySelector('[data-level-up]');
    expect(row).not.toBeNull();
    expect(row.textContent).toContain('Level 2');
    expect(row.textContent).toContain('+200');
    expect(panel.querySelector('[role="progressbar"][aria-label^="Level"]').getAttribute('aria-label'))
      .toBe('Level 2: 15 of 150 XP');
    // The panel is the announcement, so App must not toast it as well.
    expect(useGameStore.getState().pendingLevelUps).toEqual([]);
    // Confetti at the beat the bar tops out.
    expect(celebrate).not.toHaveBeenCalled();
    await act(() => new Promise((resolve) => { setTimeout(resolve, 1700); }));
    expect(celebrate).toHaveBeenCalledTimes(1);
  });

  it('names a Battle Pass tier the battle opened', async () => {
    seed({ level: 1, xp: 0, seasonXP: 90 }); // tier 2 opens at 100; a loss pays 20
    await renderBoard({ onBackToMenu: () => {} });
    const panel = await concede();
    expect(panel.querySelector('[data-pass-tier]')?.textContent).toBe('Battle Pass tier 2 unlocked');
  });
});
