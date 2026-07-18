import { damageToCreatureHp, resolveCreatureHit } from './battleUtils';

describe('damageToCreatureHp (creature-HP model)', () => {
  it('deals the full attack to HP by default', () => {
    expect(damageToCreatureHp({ attack: 5 }, { defense: 3 })).toBe(5);
  });

  it('halves damage against a shield (floored)', () => {
    expect(damageToCreatureHp({ attack: 5 }, { ability: 'shield' })).toBe(2);
  });

  it('piercing cuts through shield for full damage', () => {
    expect(damageToCreatureHp({ attack: 5, ability: 'piercing' }, { ability: 'shield' })).toBe(5);
  });

  it('never goes negative', () => {
    expect(damageToCreatureHp({ attack: 0 }, { defense: 3 })).toBe(0);
  });
});

describe('resolveCreatureHit (creature-HP model)', () => {
  it('a non-lethal hit leaves the creature alive with reduced HP and no trample', () => {
    const { survivor, overkill } = resolveCreatureHit({ attack: 2 }, { attack: 1, defense: 4, currentHp: 4 });
    expect(survivor.currentHp).toBe(2);
    expect(overkill).toBe(0);
  });

  it('falls back to defense as HP when the creature has not been hit yet', () => {
    const { survivor } = resolveCreatureHit({ attack: 1 }, { attack: 1, defense: 3 });
    expect(survivor.currentHp).toBe(2);
  });

  it('fury grants +1 attack only when the creature survives', () => {
    const survived = resolveCreatureHit({ attack: 1 }, { attack: 3, defense: 3, ability: 'fury', currentHp: 3 });
    expect(survived.survivor.attack).toBe(4);
    const died = resolveCreatureHit({ attack: 5 }, { attack: 3, defense: 3, ability: 'fury', currentHp: 3 });
    expect(died.survivor).toBeNull();
  });

  it('a lethal hit destroys the creature and trickles overkill to face', () => {
    const { survivor, overkill } = resolveCreatureHit({ attack: 5 }, { attack: 1, defense: 3, currentHp: 3 });
    expect(survivor).toBeNull();
    expect(overkill).toBe(2); // 5 attack - 3 HP = 2 trample
  });

  it('an exactly-lethal hit destroys with zero trample', () => {
    const { survivor, overkill } = resolveCreatureHit({ attack: 3 }, { attack: 1, defense: 3, currentHp: 3 });
    expect(survivor).toBeNull();
    expect(overkill).toBe(0);
  });
});
