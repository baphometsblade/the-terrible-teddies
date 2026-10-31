import { describe, it, expect } from 'vitest';
import { lastCallSide, lastCallDue, nearDeathDue } from './lastCall';
import { LAST_CALL_HP, ACHIEVEMENTS } from '@/stores/gameStore';

// The board's side of the number the comeback achievement shares (the store
// pins the achievement's side in gameStore.test.js): the lights come up at
// exactly the HP the comeback is advertised at, and not one point sooner.
describe('lastCallSide', () => {
  it('answers to the HP the comeback achievement is advertised at', () => {
    const comeback = ACHIEVEMENTS.find((a) => a.id === 'comeback');
    expect(comeback.description).toContain(String(LAST_CALL_HP));
    expect(lastCallSide({ playerHealth: LAST_CALL_HP, opponentHealth: 30 })).toBe('player');
    expect(lastCallSide({ playerHealth: LAST_CALL_HP + 1, opponentHealth: 30 })).toBeNull();
  });

  it('is Chuck\'s side too, at the same line', () => {
    expect(lastCallSide({ playerHealth: 30, opponentHealth: LAST_CALL_HP })).toBe('opponent');
    expect(lastCallSide({ playerHealth: 30, opponentHealth: LAST_CALL_HP + 1 })).toBeNull();
  });

  it('waits for the very last point of health, and not past it', () => {
    expect(lastCallSide({ playerHealth: 1, opponentHealth: 30 })).toBe('player');
    expect(lastCallSide({ playerHealth: 30, opponentHealth: 1 })).toBe('opponent');
  });

  // At 0 the game is over and the result panel has the table: a side that has
  // just died is not one the lights come up for.
  it('does not answer to a side with no health left', () => {
    expect(lastCallSide({ playerHealth: 0, opponentHealth: 30 })).toBeNull();
    expect(lastCallSide({ playerHealth: 30, opponentHealth: 0 })).toBeNull();
    expect(lastCallSide({ playerHealth: -2, opponentHealth: 30 })).toBeNull();
  });

  it('is the side with less left when both are in range, the player\'s on a tie', () => {
    expect(lastCallSide({ playerHealth: 4, opponentHealth: 2 })).toBe('opponent');
    expect(lastCallSide({ playerHealth: 2, opponentHealth: 4 })).toBe('player');
    expect(lastCallSide({ playerHealth: 3, opponentHealth: 3 })).toBe('player');
  });

  it('is the side still standing when the other has just died', () => {
    expect(lastCallSide({ playerHealth: 3, opponentHealth: 0 })).toBe('player');
    expect(lastCallSide({ playerHealth: 0, opponentHealth: 3 })).toBe('opponent');
  });
});

describe('lastCallDue', () => {
  const live = {
    gameId: 0, firedIn: null, deckReady: true, gameOver: false, playerHealth: 30, opponentHealth: 30,
  };

  it('fires for the side that is down, with what it has left', () => {
    expect(lastCallDue({ ...live, playerHealth: 4 })).toEqual({ side: 'player', hp: 4 });
    expect(lastCallDue({ ...live, opponentHealth: LAST_CALL_HP })).toEqual({ side: 'opponent', hp: LAST_CALL_HP });
  });

  it('does not fire while both are above the line', () => {
    expect(lastCallDue({ ...live, playerHealth: LAST_CALL_HP + 1, opponentHealth: LAST_CALL_HP + 1 })).toBeNull();
  });

  it('fires once per game: not again in the game it fired in, whichever side is down', () => {
    expect(lastCallDue({ ...live, firedIn: 0, playerHealth: 3 })).toBeNull();
    expect(lastCallDue({ ...live, firedIn: 0, opponentHealth: 2 })).toBeNull();
    expect(lastCallDue({ ...live, firedIn: 0, playerHealth: 1, opponentHealth: 1 })).toBeNull();
  });

  it('is a new night when Play Again bumps the game', () => {
    expect(lastCallDue({ ...live, gameId: 1, firedIn: 0, playerHealth: 3 })).toEqual({ side: 'player', hp: 3 });
  });

  // Before the deal the health is the last game's, or the defaults'.
  it('waits for the deal, and stops at game over', () => {
    expect(lastCallDue({ ...live, deckReady: false, playerHealth: 3 })).toBeNull();
    expect(lastCallDue({ ...live, gameOver: true, playerHealth: 3 })).toBeNull();
  });
});

// Chuck's near-death line and last call can arrive in the same commit (one hit
// from above 8 to 5 or less); a bubble keeps only the later line, so last call,
// the bigger moment, is the one that gets said.
describe('nearDeathDue', () => {
  const base = { gameId: 1, quipped: false, gameOver: false, playerHealth: 30, opponentHealth: 7, lastCallSpoke: null };

  it('is due once Chuck is at 8 or fewer and still standing, and only once', () => {
    expect(nearDeathDue({ ...base, opponentHealth: 9 })).toBe(false);
    expect(nearDeathDue({ ...base, opponentHealth: 8 })).toBe(true);
    expect(nearDeathDue({ ...base, opponentHealth: 0 })).toBe(false);
    expect(nearDeathDue({ ...base, quipped: true })).toBe(false);
    expect(nearDeathDue({ ...base, gameOver: true })).toBe(false);
  });

  it('stands aside for the last call said in the same commit', () => {
    // One hit from 9 to LAST_CALL_HP: both lines are due, last call wins.
    const arrived = { ...base, opponentHealth: LAST_CALL_HP };
    expect(nearDeathDue(arrived)).toBe(true);
    const spoke = { gameId: 1, playerHealth: 30, opponentHealth: LAST_CALL_HP };
    expect(nearDeathDue({ ...arrived, lastCallSpoke: spoke })).toBe(false);
  });

  it('is due again at the next change, so he still sweats later', () => {
    const spoke = { gameId: 1, playerHealth: 30, opponentHealth: LAST_CALL_HP };
    expect(nearDeathDue({ ...base, opponentHealth: LAST_CALL_HP - 1, lastCallSpoke: spoke })).toBe(true);
    expect(nearDeathDue({ ...base, opponentHealth: LAST_CALL_HP, playerHealth: 25, lastCallSpoke: spoke })).toBe(true);
  });

  it('is not held back by a last call from another game, or one said for the player earlier', () => {
    const elsewhere = { gameId: 0, playerHealth: 30, opponentHealth: LAST_CALL_HP };
    expect(nearDeathDue({ ...base, opponentHealth: LAST_CALL_HP, lastCallSpoke: elsewhere })).toBe(true);
    const earlier = { gameId: 1, playerHealth: 4, opponentHealth: 20 };
    expect(nearDeathDue({ ...base, playerHealth: 4, opponentHealth: 8, lastCallSpoke: earlier })).toBe(true);
  });
});
