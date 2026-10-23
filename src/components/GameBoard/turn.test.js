import { describe, it, expect } from 'vitest';
import { energyForTurn, cardWouldDoSomething, hasMoveLeft, MAX_FIELD_SIZE, MOMENTUM_MAX } from './turn';

const creature = (over = {}) => ({ type: 'action', cost: 2, attack: 2, defense: 2, ability: 'none', ...over });
const special = (effect, over = {}) => ({ type: 'special', effect, cost: 1, amount: 2, ...over });

// A turn-start state with nothing in it; each test adds the one thing it is about.
const state = (over = {}) => ({
  hand: [], field: [], energy: 3, health: 30, maxHealth: 30, deckSize: 5, momentum: 0, ...over,
});

describe('energyForTurn', () => {
  it('starts at 3 and grows by one every second turn', () => {
    expect([1, 2, 3, 4, 5, 6].map(energyForTurn)).toEqual([3, 4, 4, 5, 5, 6]);
  });

  it('never goes past 10', () => {
    expect(energyForTurn(14)).toBe(10);
    expect(energyForTurn(40)).toBe(10);
  });
});

describe('cardWouldDoSomething', () => {
  it('a heal does nothing at full health', () => {
    expect(cardWouldDoSomething(special('heal'), state())).toBe(false);
    expect(cardWouldDoSomething(special('heal'), state({ health: 29 }))).toBe(true);
  });

  it('a draw does nothing from an empty deck', () => {
    expect(cardWouldDoSomething(special('draw'), state({ deckSize: 0 }))).toBe(false);
    expect(cardWouldDoSomething(special('draw'), state({ deckSize: 1 }))).toBe(true);
  });

  it('a buff does nothing without a creature to pump (a trap does not count)', () => {
    expect(cardWouldDoSomething(special('buff'), state({ field: [{ type: 'trap' }] }))).toBe(false);
    expect(cardWouldDoSomething(special('buff'), state({ field: [creature()] }))).toBe(true);
  });

  it('a creature needs a free place on the table', () => {
    const full = Array.from({ length: MAX_FIELD_SIZE }, () => creature());
    expect(cardWouldDoSomething(creature(), state({ field: full }))).toBe(false);
    expect(cardWouldDoSomething(creature(), state({ field: full.slice(1) }))).toBe(true);
  });
});

describe('hasMoveLeft', () => {
  it('an empty turn has no move', () => {
    expect(hasMoveLeft(state())).toBe(false);
  });

  it('an affordable card is a move, an unaffordable one is not', () => {
    expect(hasMoveLeft(state({ hand: [creature({ cost: 3 })] }))).toBe(true);
    expect(hasMoveLeft(state({ hand: [creature({ cost: 4 })] }))).toBe(false);
  });

  it('prices swarm at its discount, as playCard does', () => {
    const swarm = creature({ ability: 'swarm', cost: 4 });
    expect(hasMoveLeft(state({ hand: [swarm], field: [creature({ hasAttacked: true })] }))).toBe(true);
    expect(hasMoveLeft(state({ hand: [swarm] }))).toBe(false);
  });

  it('a ready creature is a move; a warming-up or spent one, or a trap, is not', () => {
    expect(hasMoveLeft(state({ field: [creature()] }))).toBe(true);
    expect(hasMoveLeft(state({ field: [creature({ summoningSick: true })] }))).toBe(false);
    expect(hasMoveLeft(state({ field: [creature({ hasAttacked: true })] }))).toBe(false);
    expect(hasMoveLeft(state({ field: [{ type: 'trap' }] }))).toBe(false);
  });

  it('a legal play that would do nothing is not a move', () => {
    expect(hasMoveLeft(state({ hand: [special('heal')] }))).toBe(false);
  });

  it('a full gauge is a move only with a creature to rally', () => {
    const spent = creature({ hasAttacked: true });
    expect(hasMoveLeft(state({ momentum: MOMENTUM_MAX, field: [spent] }))).toBe(true);
    expect(hasMoveLeft(state({ momentum: MOMENTUM_MAX }))).toBe(false);
    expect(hasMoveLeft(state({ momentum: MOMENTUM_MAX - 1, field: [spent] }))).toBe(false);
  });
});
