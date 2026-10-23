import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';

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
    const board = [{ trophies: 500 }, { trophies: 300 }, { trophies: 100 }];
    expect(placeOnBoard(board, 400)).toBe(2);
    expect(placeOnBoard(board, 50)).toBe(4); // a short board is every player
  });

  it('is "50+" below a full board, never a made-up #51', () => {
    const board = Array.from({ length: BOARD_SIZE }, () => ({ trophies: 800 }));
    expect(placeOnBoard(board, 10)).toBe(`${BOARD_SIZE}+`);
    expect(placeOnBoard(board, 900)).toBe(1);
  });

  it('shows "50+" in Your Ranking when the player is past the rows fetched', async () => {
    rows = Array.from({ length: BOARD_SIZE }, (_, i) => rival(i));
    await open();
    expect(yourRank().textContent).toBe(`${BOARD_SIZE}+Outside the top ${BOARD_SIZE}`);
    expect(host.textContent).not.toContain(`#${BOARD_SIZE + 1}`);
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
    rows = [{ ...rival(1), username: 'GrizzlyAdamsFamily' }];
    await open();
    const name = [...host.querySelectorAll('ol li div')].find((d) => d.textContent === 'GrizzlyAdamsFamily');
    expect(name.querySelectorAll('wbr')).toHaveLength(2);
  });
});
