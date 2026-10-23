import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// The board's rows, as the leaderboard view would return them.
let rows = [];
vi.mock('../lib/supabase', () => ({
  supabase: {
    from: () => ({ select: () => ({ limit: (n) => Promise.resolve({ data: rows.slice(0, n), error: null }) }) }),
  },
}));

import Leaderboard, { BOARD_SIZE, placeOnBoard, nameBreaks } from './Leaderboard';
import { useGameStore } from '@/stores/gameStore';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

// A rival with plenty of trophies (wins count 8 each).
const rival = (i, wins = 100) => ({ username: `Rival${i}`, wins, losses: 0, experience: 0, best_win_streak: 0 });

let host;
let root;
const open = async () => {
  await act(async () => { root.render(<Leaderboard onClose={() => {}} />); });
  // The fetch resolves on a microtask; let it land.
  await act(async () => {});
};
const yourRank = () => host.querySelector('h3 + div [class*="rounded-full"]');

beforeEach(() => {
  localStorage.clear();
  useGameStore.getState().resetProgress();
  useGameStore.setState({ playerName: 'QA Bear', level: 1, totalWins: 0, currentWinStreak: 0, bestWinStreak: 0 });
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

describe('the player\'s place on the board', () => {
  it('is a number while the player lands among the rows', () => {
    const board = [{ trophies: 500, wins: 50 }, { trophies: 300, wins: 30 }, { trophies: 100, wins: 10 }];
    expect(placeOnBoard(board, { trophies: 400, wins: 40, experience: 0 })).toBe(2);
    // A short board is every player.
    expect(placeOnBoard(board, { trophies: 50, wins: 0, experience: 0 })).toBe(4);
  });

  it('is "50+" below a full board, never a made-up #51', () => {
    const board = Array.from({ length: BOARD_SIZE }, () => ({ trophies: 800, wins: 100, experience: 0 }));
    expect(placeOnBoard(board, { trophies: 10, wins: 0, experience: 0 })).toBe(`${BOARD_SIZE}+`);
    expect(placeOnBoard(board, { trophies: 900, wins: 101, experience: 0 })).toBe(1);
  });

  // A full board is the view's top 50 by wins, then experience. A player
  // the view would not have returned is not among the rows, however many
  // trophies their level and best streak add: they used to be ranked
  // against rows they were never compared with, up to a #1.
  it('is "50+" for a player the view would not have returned, even with more trophies', () => {
    const board = Array.from({ length: BOARD_SIZE }, () => ({ trophies: 170, wins: 20, experience: 0 }));
    expect(placeOnBoard(board, { trophies: 185, wins: 10, experience: 700 })).toBe(`${BOARD_SIZE}+`);
  });

  it('follows the view\'s order at the cut: as many wins as the last row, then experience', () => {
    const board = Array.from({ length: BOARD_SIZE }, (_, i) => ({ trophies: 400 - i, wins: 30 - Math.floor(i / 10), experience: 500 }));
    // The last row has 26 wins and 500 experience.
    expect(placeOnBoard(board, { trophies: 1000, wins: 26, experience: 500 })).toBe(1);
    expect(placeOnBoard(board, { trophies: 1000, wins: 26, experience: 499 })).toBe(`${BOARD_SIZE}+`);
    expect(placeOnBoard(board, { trophies: 395, wins: 27, experience: 0 })).toBe(6);
  });

  it('shows "50+" in Your Ranking when the player is past the rows fetched', async () => {
    rows = Array.from({ length: BOARD_SIZE }, (_, i) => rival(i));
    await open();
    expect(yourRank().textContent).toBe(`${BOARD_SIZE}+Outside the top ${BOARD_SIZE}`);
    expect(host.textContent).not.toContain(`#${BOARD_SIZE + 1}`);
  });

  it('shows "50+" in Your Ranking for fewer wins than every row, whatever the trophies', async () => {
    // Fifty rows at 20 wins (170 trophies); the player has 10 wins but level 8
    // and a best streak of 5, so 185 trophies. This printed "#1".
    rows = Array.from({ length: BOARD_SIZE }, (_, i) => rival(i, 20));
    useGameStore.setState({ totalWins: 10, level: 8, xp: 0, bestWinStreak: 5 });
    await open();
    expect(yourRank().textContent).toBe(`${BOARD_SIZE}+Outside the top ${BOARD_SIZE}`);
  });

  it('counts the player\'s row with the same streak the other rows show', async () => {
    // Every row shows best_win_streak; Your Ranking showed the current one,
    // so a player on a 0-game run with a best of 7 had no streak on their own
    // row and a 7 on the board's copy of it.
    rows = [rival(1)];
    useGameStore.setState({ currentWinStreak: 0, bestWinStreak: 7 });
    await open();
    const mine = host.querySelector('h3 + div');
    expect(mine.textContent).toContain('7win streak');
  });
});

describe('the board\'s chrome', () => {
  // The build targets Safari 16 (Vite's baseline), and lookbehind only
  // arrived in 16.4: esbuild turns the literal into new RegExp(...), which
  // throws there the moment a podium name renders. Node runs it fine, so
  // only the source can show it.
  it('splits names without a regex lookbehind', () => {
    const src = readFileSync(resolve(process.cwd(), 'src/components/Leaderboard.jsx'), 'utf8');
    expect(src).not.toMatch(/\(\?<[=!]/);
  });

  it('names its one scope in a caption, with no control that does nothing', async () => {
    rows = [rival(1)];
    await open();
    expect(host.textContent).toContain('Global · All time');
    expect(host.querySelectorAll('[aria-pressed]')).toHaveLength(0);
  });

  it('lets a run-together podium name wrap between its words', async () => {
    expect(nameBreaks('GrizzlyAdamsFamily')).toEqual(['Grizzly', 'Adams', 'Family']);
    expect(nameBreaks('QABear')).toEqual(['QA', 'Bear']);
    expect(nameBreaks('Player_ab12cd34')).toEqual(['Player_', 'ab', '12cd', '34']);
    expect(nameBreaks('Teddy A1B2')).toEqual(['Teddy A1B2']);
    expect(nameBreaks('x')).toEqual(['x']);
    expect(nameBreaks('Bear-')).toEqual(['Bear-']);
    rows = [{ ...rival(1), username: 'GrizzlyAdamsFamily' }];
    await open();
    const name = [...host.querySelectorAll('ol li div')].find((d) => d.textContent === 'GrizzlyAdamsFamily');
    expect(name.querySelectorAll('wbr')).toHaveLength(2);
  });
});
