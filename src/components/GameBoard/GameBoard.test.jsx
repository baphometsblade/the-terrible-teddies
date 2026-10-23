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

import GameBoard from './GameBoard';

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
