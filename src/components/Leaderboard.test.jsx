import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// The backend. `rows`: the old leaderboard view (wins order, no rank).
// `rankedRows`: leaderboard_trophies, or null where the migration has not
// landed (PostgREST's 404). `rankAnswer`: what get_my_rank returns, or null
// for a backend without it (404 too).
let rows = [];
let rankedRows = null;
let rankAnswer = null;
const missing = (code) => ({ data: null, error: { code, message: 'Could not find it in the schema cache' }, status: 404 });
vi.mock('../lib/supabase', () => ({
  supabase: {
    from: (name) => ({
      select: () => {
        const answer = (n) => {
          if (name === 'leaderboard_trophies') {
            return rankedRows === null ? missing('PGRST205') : { data: rankedRows.slice(0, n), error: null, status: 200 };
          }
          return { data: rows.slice(0, n), error: null, status: 200 };
        };
        const query = { order: () => query, limit: (n) => Promise.resolve(answer(n)) };
        return query;
      },
    }),
    rpc: () => Promise.resolve(rankAnswer ?? missing('PGRST202')),
  },
}));

import Leaderboard, {
  BOARD_SIZE, placeOnBoard, placeOnTrophyBoard, nameBreaks, calculateTrophies, calculateLevel,
} from './Leaderboard';
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
  // A backend without the 20261023000000 migration, unless a test says so.
  rankedRows = null;
  rankAnswer = null;
  localStorage.clear();
  // A clean store, not resetProgress: a reset keeps gems, packs, the pass and
  // the claim ledgers, which would leak from one test into the next.
  useGameStore.setState(useGameStore.getInitialState(), true);
  useGameStore.setState({ playerName: 'QA Bear', level: 1, totalWins: 0, currentWinStreak: 0, bestWinStreak: 0 });
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

// The same fixture check-migrations.sh runs public.player_trophies over:
// (wins, experience, best streak) -> trophies. The server orders and ranks
// the board by its copy of this formula, so the two must agree.
describe('the trophy formula', () => {
  it('matches the server\'s player_trophies on the shared fixture', () => {
    const fixture = [
      [0, 0, 0, 10], [null, null, null, 10], [3, 250, 2, 64], [10, 99, 0, 90],
      [10, 100, 0, 100], [5, -50, 1, 55], [0, -150, 0, 10], [120, 4321, 9, 1445],
    ];
    for (const [wins, experience, streak, trophies] of fixture) {
      expect(calculateTrophies(wins, calculateLevel(experience), streak)).toBe(trophies);
    }
  });
});

describe('with the server\'s rank (leaderboard_trophies and get_my_rank)', () => {
  // A ranked row as the view returns it.
  const ranked = (i, over = {}) => ({
    username: `Rival${i}`, wins: 200 - i, losses: 0, experience: 0, best_win_streak: 0,
    trophies: calculateTrophies(200 - i, 1, 0), rank: i, is_me: false, ...over,
  });

  it('says the player\'s real place, however far down the board: never "50+", never #51', async () => {
    rankedRows = Array.from({ length: BOARD_SIZE }, (_, i) => ranked(i + 1));
    rankAnswer = { data: [{ rank: 137, trophies: 90, username: 'QA Bear', wins: 10, experience: 0, best_win_streak: 0 }], error: null, status: 200 };
    await open();
    expect(yourRank().textContent).toBe('#137');
    const mine = host.querySelector('h3 + div');
    expect(mine.textContent).toContain('90trophies');
    expect(host.textContent).not.toContain(`${BOARD_SIZE}+`);
  });

  it('shows Your Ranking as the board records the player, not the local stats', async () => {
    // Locally: Level 1, no wins (a reset on this device). The board still
    // counts the server's record, and Your Ranking must agree with it.
    rankedRows = [ranked(1), ranked(2, { username: 'Grizzly', wins: 30, experience: 450, trophies: 300, rank: 2, is_me: true })];
    rankAnswer = { data: [{ rank: 2, trophies: 300, username: 'Grizzly', wins: 30, experience: 450, best_win_streak: 0 }], error: null, status: 200 };
    await open();
    const mine = host.querySelector('h3 + div');
    expect(mine.textContent).toContain('Grizzly');
    expect(mine.textContent).toContain('Level 5 · 30 wins');
    expect(yourRank().textContent).toBe('#2');
  });

  it('highlights the player\'s own row in the list and on the podium', async () => {
    rankedRows = Array.from({ length: 10 }, (_, i) => ranked(i + 1, { is_me: i === 6 }));
    await open();
    const list = [...host.querySelectorAll('ol[start="4"] > li')];
    const badged = list.filter((li) => li.textContent.includes('YOU'));
    expect(badged).toHaveLength(1);
    expect(badged[0].textContent).toContain('Rival7');
    expect(badged[0].querySelector('[class*="trim-brass"]')).not.toBeNull();
    // On the podium too.
    rankedRows = Array.from({ length: 5 }, (_, i) => ranked(i + 1, { is_me: i === 0 }));
    act(() => root.unmount());
    root = createRoot(host);
    await open();
    const podium = host.querySelector('ol:not([start])');
    expect(podium.textContent).toContain('YOU');
  });

  it('shows ties as the server ranks them: a shared place, and the next one skipped', async () => {
    rankedRows = [
      ranked(1, { username: 'Tied A', trophies: 500, rank: 1 }),
      ranked(2, { username: 'Tied B', trophies: 500, rank: 1 }),
      ranked(3, { username: 'Third', trophies: 400, rank: 3 }),
      ranked(4, { username: 'Fourth', trophies: 300, rank: 4 }),
    ];
    await open();
    const podiumRanks = [...host.querySelectorAll('ol:not([start]) li')].map((li) => li.querySelector('.sr-only').parentElement.textContent);
    expect(podiumRanks).toEqual(['Rank 1', 'Rank 1', 'Rank 3']);
    expect(host.querySelector('ol[start="4"]').textContent).toContain('#4');
  });

  it('places the player on the trophy board when get_my_rank cannot say', async () => {
    // Full board, the player below its last row: "50+".
    rankedRows = Array.from({ length: BOARD_SIZE }, (_, i) => ranked(i + 1));
    await open();
    expect(yourRank().textContent).toBe(`${BOARD_SIZE}+Outside the top ${BOARD_SIZE}`);
    // The pure rule: a short board is every player; a full one holds everyone
    // above its last row; the player's own (possibly stale) row is not counted.
    const board = [{ trophies: 500 }, { trophies: 300, isMe: true }, { trophies: 100 }];
    expect(placeOnTrophyBoard(board, 400)).toBe(2);
    expect(placeOnTrophyBoard(board, 50)).toBe(3);
    const full = Array.from({ length: BOARD_SIZE }, (_, i) => ({ trophies: 1000 - i }));
    expect(placeOnTrophyBoard(full, 951)).toBe(50);
    expect(placeOnTrophyBoard(full, 950)).toBe(`${BOARD_SIZE}+`);
  });
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
