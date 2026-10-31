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
// Chuck's crew is random every fight. A test that needs his damage to be
// countable sets `fixedCrew.cards` to the crew it wants, and gets exactly
// that; with none set, the real builder deals as it always does.
const fixedCrew = vi.hoisted(() => ({ cards: null }));
vi.mock('../../utils/opponentDeck', async (importOriginal) => {
  const real = await importOriginal();
  return {
    ...real,
    buildOpponentDeck: (...args) => (fixedCrew.cards
      ? { cards: fixedCrew.cards, crewName: 'the Test Crew' }
      : real.buildOpponentDeck(...args)),
  };
});

import GameBoard from './GameBoard';
import { useGameStore, LAST_CALL_HP } from '../../stores/gameStore';
import { celebrate } from '@/lib/celebrate';
import { QUIPS } from '../../utils/teddyTalk';
import { lastCallLog } from '@/lib/houseLines';

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

// The first time either side is down to LAST_CALL_HP the house lights come up,
// once a game, for whoever gets there first. Chuck has to be countable for
// that, so his crew here is one bruiser and nothing else: once he is out of
// summoning sickness he hits the player's face for his attack each round, and
// the player (who does nothing) goes down a round at a time: with an attack of
// 5, 30, 30, 25, 20, 15, 10, 5 and out. The timers are faked so a round is
// instant; the board is the real one, under StrictMode, with the real store.
describe('GameBoard last call', () => {
  // Chuck's whole crew for the next deal: one hitter with this attack.
  const facing = (attack) => {
    fixedCrew.cards = [{
      id: 999, name: 'Test Bruiser', attack, defense: 9, type: 'action', cost: 1,
      ability: 'none', rarity: 'common', instanceId: 'o-999-0',
    }];
  };

  const board = () => container.querySelector('.game-surface');
  const lit = () => board().hasAttribute('data-last-call');
  const logLines = () => [...container.querySelectorAll('[role="log"] > div')].map((e) => e.textContent);
  const lastCallLines = () => logLines().filter((line) => line.startsWith('Last call.'));
  const bannerKind = () => container.querySelector('[data-banner]')?.getAttribute('data-banner') ?? null;
  const health = () => Number(container.querySelector('[aria-label^="Your health"]').getAttribute('aria-label').match(/: (\d+) of/)[1]);

  const advance = (ms) => act(async () => { vi.advanceTimersByTime(ms); });
  // Steps the faked clock in small bites, so React renders (and schedules the
  // next timer) between them as it would in a browser.
  const advanceUntil = async (done, limitMs = 8000) => {
    for (let waited = 0; !done() && waited < limitMs; waited += 100) await advance(100);
    expect(done(), 'the board never got there').toBeTruthy();
  };
  // Waits for the player's turn (a round may have been left mid-way through
  // Chuck's), then ends it.
  const endTurn = async () => {
    await advanceUntil(() => button('End Turn'));
    await act(async () => button('End Turn').click());
  };
  const defeated = () => container.querySelector('[role="dialog"][aria-label="Defeat"]');
  // Deals the game and waits out the draw phase, when End Turn appears.
  const startGame = async () => {
    await renderBoard({ onBackToMenu: () => {} });
    await advanceUntil(() => button('End Turn'));
  };
  // Rounds until the player's health reads `hp`, stopping the moment it does.
  const playUntilHealth = async (hp) => {
    for (let round = 0; round < 20 && health() > hp; round += 1) {
      await endTurn();
      await advanceUntil(() => health() <= hp || (button('End Turn') && health() > hp));
    }
    expect(health()).toBe(hp);
  };

  beforeEach(() => {
    useGameStore.setState(useGameStore.getInitialState(), true);
    facing(LAST_CALL_HP);
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });
  });
  afterEach(() => {
    vi.useRealTimers();
    fixedCrew.cards = null;
  });

  it('comes up at exactly LAST_CALL_HP: the room, the log, the banner and Chuck', async () => {
    await startGame();
    expect(container.querySelector('.house-lights'), 'the lights are in the room from the start').not.toBeNull();
    expect(container.querySelector('.felt-table .felt-lamp'), 'and the lamp over the felt').not.toBeNull();

    // Above the line, nothing: at 10 (one hit away) the room is still dark.
    await playUntilHealth(LAST_CALL_HP * 2);
    expect(lit()).toBe(false);
    expect(lastCallLines()).toEqual([]);
    expect(bannerKind()).not.toBe('last-call');

    await playUntilHealth(LAST_CALL_HP);
    expect(lit()).toBe(true);
    expect(lastCallLines()).toEqual([lastCallLog('player', LAST_CALL_HP)]);
    expect(bannerKind()).toBe('last-call');
    expect(container.querySelector('[data-banner="last-call"]').textContent).toBe('Last call');
    // Chuck says a line from his lastCall pool, after the log has said it.
    const lines = logLines();
    const said = lines.find((line) => QUIPS.lastCall.some((q) => line === `🧸 Chuck: "${q}"`));
    expect(said, `Chuck's line is from the lastCall pool: ${lines.join(' | ')}`).toBeTruthy();
    expect(lines.indexOf(said)).toBeGreaterThan(lines.indexOf(lastCallLog('player', LAST_CALL_HP)));
    // Everything drawn is for the eye alone: the log is the record.
    expect(container.querySelector('.house-lights').getAttribute('aria-hidden')).toBe('true');
    expect(container.querySelector('[data-banner]').closest('[aria-hidden="true"]')).not.toBeNull();
  });

  // The wave that takes the player to 5 is followed half a second later by
  // "Your turn", which used to be alone on the felt. Last call keeps it for
  // its 1.3 s and the turn's banner follows, whole.
  it('keeps its banner for its full time, and the next turn\'s banner follows it', async () => {
    await startGame();
    await playUntilHealth(LAST_CALL_HP);
    expect(bannerKind()).toBe('last-call');
    await advance(700); // the turn has changed hands (500 ms after the wave)
    expect(container.querySelector('[data-banner="last-call"]'), 'Your turn must not cut it short').not.toBeNull();
    await advance(700); // past last call's 1.3 s
    expect(bannerKind()).toBe('turn');
    expect(container.querySelector('[data-banner="turn"]').textContent).toBe('Your turn');
    await advance(1500);
    expect(bannerKind()).toBeNull();
  });

  it('fires once a game however the health goes on, and again in the next game after Play Again', async () => {
    // 2 a round: the player is in range at 4, and again at 2, and the second
    // visit to the range must not call it a second time.
    facing(2);
    await startGame();
    // Every last-call line that is ever added to the log, counted as it comes.
    const seen = [];
    const watcher = new MutationObserver((records) => {
      for (const record of records) {
        for (const node of record.addedNodes) {
          if (node.textContent?.startsWith('Last call.')) seen.push(node.textContent);
        }
      }
    });
    watcher.observe(container.querySelector('[role="log"]'), { childList: true, subtree: true });

    await playUntilHealth(LAST_CALL_HP + 1);
    expect(seen).toHaveLength(0);
    await playUntilHealth(LAST_CALL_HP - 1);
    expect(seen).toEqual([lastCallLog('player', LAST_CALL_HP - 1)]);
    await playUntilHealth(LAST_CALL_HP - 3);
    expect(seen, 'in range again, but it is the same game').toHaveLength(1);
    // On to the end: down to 0, game over. No second call for the same game.
    await playUntilHealth(0);
    await advanceUntil(defeated);
    expect(seen).toHaveLength(1);
    // The lights stay up under the result panel.
    expect(lit()).toBe(true);

    // Play Again is a new night: the room goes dark, and the next game's
    // last call lights it again.
    facing(LAST_CALL_HP);
    await act(async () => button('Play Again').click());
    await advanceUntil(() => button('End Turn'));
    expect(lit()).toBe(false);
    expect(health()).toBe(30);
    expect(lastCallLines()).toEqual([]);
    await playUntilHealth(LAST_CALL_HP);
    expect(lit()).toBe(true);
    expect(seen).toHaveLength(2);
    watcher.disconnect();
  });

  it('does not fire for a side that is down to nothing: a concede is not a last call', async () => {
    await renderBoard({ onBackToMenu: () => {} });
    await act(async () => container.querySelector('button[title="Concede"]').click());
    await act(async () => button('Concede — counts as a loss').click());
    await advanceUntil(defeated);
    expect(lit()).toBe(false);
    expect(lastCallLines()).toEqual([]);
  });
});

// Between midnight and five in the morning, by the player's own clock, Chuck
// opens with his late line. The hour is read once, at the deal.
describe('GameBoard opening line', () => {
  const opener = () => {
    const line = [...container.querySelectorAll('[role="log"] > div')]
      .map((e) => e.textContent).find((text) => text.startsWith('🧸 Chuck: "'));
    return line?.slice('🧸 Chuck: "'.length, -1) ?? null;
  };

  beforeEach(() => {
    useGameStore.setState(useGameStore.getInitialState(), true);
    vi.useFakeTimers({ toFake: ['Date'] });
  });
  afterEach(() => vi.useRealTimers());

  it('is a late line at 2:30 in the morning', async () => {
    vi.setSystemTime(new Date(2027, 0, 15, 2, 30));
    await renderBoard({ onBackToMenu: () => {} });
    expect(QUIPS.gameStartLate).toContain(opener());
  });

  it('is the usual line in the afternoon, and at five sharp', async () => {
    vi.setSystemTime(new Date(2027, 0, 15, 14, 0));
    await renderBoard({ onBackToMenu: () => {} });
    expect(QUIPS.gameStart).toContain(opener());
    await act(async () => root.unmount());
    root = createRoot(container);
    vi.setSystemTime(new Date(2027, 0, 15, 5, 0));
    await renderBoard({ onBackToMenu: () => {} });
    expect(QUIPS.gameStart).toContain(opener());
  });
});
