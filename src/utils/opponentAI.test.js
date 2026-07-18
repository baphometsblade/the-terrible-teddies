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

  describe('HP-aware (attacker provided)', () => {
    // card(id, cost, attack, defense); currentHp defaults to defense via the resolver.
    it('secures a kill over merely chipping a bigger threat', () => {
      const attacker = card(9, 1, 3, 1); // deals 3
      // id2 is the biggest threat (attack 6) but has 5 HP — not killable.
      // id3 (attack 4) has 3 HP — killable this hit. Prefer the kill.
      const targets = [card(2, 1, 6, 5), card(3, 1, 4, 3)];
      expect(chooseAttackTarget(targets, attacker).id).toBe(3);
    });

    it('among killable targets, kills the biggest threat', () => {
      const attacker = card(9, 1, 5, 1); // deals 5 — kills both below
      const targets = [card(2, 1, 3, 2), card(3, 1, 6, 4)];
      expect(chooseAttackTarget(targets, attacker).id).toBe(3); // higher attack
    });

    it('when nothing is killable, chips the biggest threat, tie-broken by lowest remaining HP', () => {
      const attacker = card(9, 1, 1, 1); // deals 1 — kills nothing (all HP >= 2)
      const a = { ...card(2, 1, 6, 5), currentHp: 5 };
      const b = { ...card(3, 1, 6, 5), currentHp: 2 }; // same attack, closer to dead
      expect(chooseAttackTarget([a, b], attacker).id).toBe(3);
    });

    it('respects shield when judging lethality', () => {
      const attacker = card(9, 1, 4, 1); // 4, halved to 2 by shield
      const shielded = { ...card(2, 1, 1, 3), ability: 'shield', currentHp: 3 }; // 2 < 3, survives
      const plain = card(3, 1, 1, 2); // 4 >= 2, killable
      expect(chooseAttackTarget([shielded, plain], attacker).id).toBe(3);
    });
  });
});

describe('OPPONENT_ENERGY_BY_DIFFICULTY', () => {
  it('scales the budget with difficulty', () => {
    expect(OPPONENT_ENERGY_BY_DIFFICULTY.easy).toBeLessThan(OPPONENT_ENERGY_BY_DIFFICULTY.normal);
    expect(OPPONENT_ENERGY_BY_DIFFICULTY.normal).toBeLessThan(OPPONENT_ENERGY_BY_DIFFICULTY.hard);
  });
});
