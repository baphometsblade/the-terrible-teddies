import { chooseOpponentPlays, chooseAttackTarget, OPPONENT_ENERGY_BY_DIFFICULTY } from './opponentAI';

const card = (id, cost, attack = 1, defense = 1) => ({ id, cost, attack, defense, name: `c${id}` });

describe('chooseOpponentPlays', () => {
  it('plays multiple cards within the energy budget', () => {
    const deck = [card(1, 2), card(2, 1), card(3, 4)];
    const { plays, remainingDeck, energyLeft } = chooseOpponentPlays(deck, 0, 3);
    expect(plays.map(c => c.id)).toEqual([1, 2]);
    expect(remainingDeck.map(c => c.id)).toEqual([3]);
    expect(energyLeft).toBe(0);
  });

  it('skips an unaffordable card instead of stalling on it', () => {
    // A cost-4 card on top with a budget of 2 must not block the cheap card
    // behind it — that would freeze the opponent for the rest of the game.
    const deck = [card(1, 4), card(2, 2)];
    const { plays, remainingDeck } = chooseOpponentPlays(deck, 0, 2);
    expect(plays.map(c => c.id)).toEqual([2]);
    expect(remainingDeck.map(c => c.id)).toEqual([1]);
  });

  it('respects the field cap', () => {
    const deck = [card(1, 1), card(2, 1), card(3, 1)];
    const { plays, remainingDeck } = chooseOpponentPlays(deck, 2, 10);
    expect(plays).toHaveLength(1); // only one slot free (2 on field, cap 3)
    expect(remainingDeck).toHaveLength(2);
  });

  it('plays nothing when the field is full', () => {
    const deck = [card(1, 1)];
    const { plays, remainingDeck, energyLeft } = chooseOpponentPlays(deck, 3, 5);
    expect(plays).toHaveLength(0);
    expect(remainingDeck).toHaveLength(1);
    expect(energyLeft).toBe(5);
  });

  it('handles an empty deck', () => {
    const { plays, remainingDeck, energyLeft } = chooseOpponentPlays([], 0, 3);
    expect(plays).toEqual([]);
    expect(remainingDeck).toEqual([]);
    expect(energyLeft).toBe(3);
  });

  it('preserves the order of skipped cards', () => {
    const deck = [card(1, 9), card(2, 1), card(3, 9), card(4, 1)];
    const { plays, remainingDeck } = chooseOpponentPlays(deck, 0, 2);
    expect(plays.map(c => c.id)).toEqual([2, 4]);
    expect(remainingDeck.map(c => c.id)).toEqual([1, 3]);
  });
});

describe('chooseAttackTarget', () => {
  it('returns null for no targets', () => {
    expect(chooseAttackTarget([])).toBeNull();
    expect(chooseAttackTarget(null)).toBeNull();
  });

  it('picks the highest-attack target (biggest threat)', () => {
    const targets = [card(1, 1, 2, 5), card(2, 1, 6, 1), card(3, 1, 4, 2)];
    expect(chooseAttackTarget(targets).id).toBe(2);
  });

  it('breaks attack ties by lowest defense (cheapest kill)', () => {
    const targets = [card(1, 1, 3, 4), card(2, 1, 3, 1)];
    expect(chooseAttackTarget(targets).id).toBe(2);
  });

  it('returns the sole target when only one exists', () => {
    const t = card(1, 1, 0, 0);
    expect(chooseAttackTarget([t])).toBe(t);
  });
});

describe('OPPONENT_ENERGY_BY_DIFFICULTY', () => {
  it('scales the budget with difficulty', () => {
    expect(OPPONENT_ENERGY_BY_DIFFICULTY.easy).toBeLessThan(OPPONENT_ENERGY_BY_DIFFICULTY.normal);
    expect(OPPONENT_ENERGY_BY_DIFFICULTY.normal).toBeLessThan(OPPONENT_ENERGY_BY_DIFFICULTY.hard);
  });
});
