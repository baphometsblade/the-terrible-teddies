import {
  damageToCreatureHp, resolveCreatureHit, rallyField, effectiveCost, effectiveAttack,
  canAttack, readyCreatures, getValidTargets,
  gainedFuryStack,
} from './battleUtils';

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

describe('rallyField (momentum payoff)', () => {
  it('gives creatures +1 attack and heals them to full HP', () => {
    const field = [{ type: 'action', attack: 2, defense: 4, currentHp: 1 }];
    const [c] = rallyField(field);
    expect(c.attack).toBe(3);
    expect(c.currentHp).toBe(4);
  });

  it('leaves non-creatures (traps) untouched', () => {
    const trap = { type: 'trap', attack: 0, defense: 0, amount: 3 };
    expect(rallyField([trap])[0]).toEqual(trap);
  });

  it('does not mutate the input field', () => {
    const field = [{ type: 'action', attack: 2, defense: 4, currentHp: 1 }];
    rallyField(field);
    expect(field[0].attack).toBe(2);
    expect(field[0].currentHp).toBe(1);
  });
});

describe('effectiveCost (swarm)', () => {
  const swarmCard = { cost: 3, ability: 'swarm', type: 'action' };
  const otherAction = { cost: 2, ability: 'none', type: 'action' };
  const trap = { cost: 1, ability: 'none', type: 'trap' };

  it('is unaffected for non-swarm cards, regardless of field', () => {
    const plainCard = { cost: 3, ability: 'none', type: 'action' };
    expect(effectiveCost(plainCard, [])).toBe(3);
    expect(effectiveCost(plainCard, [otherAction])).toBe(3);
  });

  it('costs full price on an empty field (no other creature to join)', () => {
    expect(effectiveCost(swarmCard, [])).toBe(3);
  });

  it('costs full price when the field has only traps, no creatures', () => {
    expect(effectiveCost(swarmCard, [trap])).toBe(3);
  });

  it('is reduced by 1 when another action card is already on the field', () => {
    expect(effectiveCost(swarmCard, [otherAction])).toBe(2);
  });

  it('never drops below 1, even for a cheap swarm card', () => {
    const cheapSwarm = { cost: 1, ability: 'swarm', type: 'action' };
    expect(effectiveCost(cheapSwarm, [otherAction])).toBe(1);
  });
});

describe('effectiveAttack (royal aura)', () => {
  const royal = { instanceId: 'r1', attack: 3, ability: 'royal', type: 'action' };
  const ally = { instanceId: 'a1', attack: 2, ability: 'none', type: 'action' };

  it("boosts an ally's attack by 1 when a royal shares the field", () => {
    expect(effectiveAttack(ally, [royal, ally])).toBe(3);
  });

  it('does not buff the royal card itself', () => {
    expect(effectiveAttack(royal, [royal, ally])).toBe(3); // unchanged base attack
  });

  it('gives no buff when the royal card is not on the field', () => {
    expect(effectiveAttack(ally, [ally])).toBe(2);
  });

  it('does not stack: two royals still only grant +1', () => {
    const royal2 = { instanceId: 'r2', attack: 4, ability: 'royal', type: 'action' };
    expect(effectiveAttack(ally, [royal, royal2, ally])).toBe(3);
  });

  it('falls back to reference equality when cards have no instanceId', () => {
    const plainRoyal = { attack: 3, ability: 'royal', type: 'action' };
    const plainAlly = { attack: 2, ability: 'none', type: 'action' };
    expect(effectiveAttack(plainAlly, [plainRoyal, plainAlly])).toBe(3);
    expect(effectiveAttack(plainRoyal, [plainRoyal, plainAlly])).toBe(3);
  });
});

describe('damageToCreatureHp / resolveCreatureHit with attackerField (royal aura wiring)', () => {
  it('damageToCreatureHp adds the royal bonus when attackerField is passed', () => {
    const royal = { instanceId: 'r1', attack: 1, ability: 'royal', type: 'action' };
    const attacker = { instanceId: 'atk', attack: 3, ability: 'none', type: 'action' };
    expect(damageToCreatureHp(attacker, { defense: 10 }, [royal, attacker])).toBe(4);
  });

  it('damageToCreatureHp ignores royal allies when attackerField is omitted (2-arg regression)', () => {
    expect(damageToCreatureHp({ attack: 5 }, { defense: 3 })).toBe(5);
  });

  it("resolveCreatureHit's damage increases by 1 when a royal ally shares the attacker's field", () => {
    const royal = { instanceId: 'r1', attack: 1, ability: 'royal', type: 'action' };
    const attacker = { instanceId: 'atk', attack: 2, ability: 'none', type: 'action' };
    const target = { attack: 0, defense: 10, currentHp: 10 };

    const withoutRoyal = resolveCreatureHit(attacker, target);
    const withRoyal = resolveCreatureHit(attacker, target, [royal, attacker]);

    expect(withoutRoyal.dmg).toBe(2);
    expect(withRoyal.dmg).toBe(3);
  });

  it('resolveCreatureHit (2-arg) behaves exactly as before — no attackerField, no aura', () => {
    const { survivor, overkill } = resolveCreatureHit({ attack: 2 }, { attack: 1, defense: 4, currentHp: 4 });
    expect(survivor.currentHp).toBe(2);
    expect(overkill).toBe(0);
  });
});

describe('fury cap (resolveCreatureHit)', () => {
  it('accumulates furyStacks and +1 attack per survived hit', () => {
    let fury = { attack: 3, defense: 10, ability: 'fury', currentHp: 10 };
    const weakAttacker = { attack: 1 };

    const hit1 = resolveCreatureHit(weakAttacker, fury);
    expect(hit1.survivor.furyStacks).toBe(1);
    expect(hit1.survivor.attack).toBe(4);

    fury = hit1.survivor;
    const hit2 = resolveCreatureHit(weakAttacker, fury);
    expect(hit2.survivor.furyStacks).toBe(2);
    expect(hit2.survivor.attack).toBe(5);
  });

  it('caps the accumulated fury bonus at +3, even after many survived hits', () => {
    let fury = { attack: 3, defense: 50, ability: 'fury', currentHp: 50 };
    const weakAttacker = { attack: 1 };

    for (let i = 0; i < 10; i++) {
      const { survivor } = resolveCreatureHit(weakAttacker, fury);
      fury = survivor;
    }

    expect(fury.furyStacks).toBe(3);
    expect(fury.attack).toBe(6); // base 3 + capped bonus 3
  });

  it('a rallied fury creature keeps its stacks — rally neither resets nor doubles them', () => {
    let fury = { attack: 3, defense: 10, ability: 'fury', currentHp: 10 };
    const weakAttacker = { attack: 1 };

    // Survive twice to build up 2 stacks (attack 3 -> 5).
    fury = resolveCreatureHit(weakAttacker, fury).survivor;
    fury = resolveCreatureHit(weakAttacker, fury).survivor;
    expect(fury.furyStacks).toBe(2);
    expect(fury.attack).toBe(5);

    // Rally: +1 permanent attack, full heal — must not touch furyStacks.
    const [rallied] = rallyField([{ ...fury, type: 'action' }]);
    expect(rallied.furyStacks).toBe(2); // unchanged, not reset, not doubled
    expect(rallied.attack).toBe(6); // 5 + rally's own +1
    expect(rallied.currentHp).toBe(rallied.defense);

    // A subsequent survive should add exactly +1 more on top of the new base
    // (rally's +1 counts as base going forward), capped at 3 total fury stacks.
    const next = resolveCreatureHit(weakAttacker, rallied);
    expect(next.survivor.furyStacks).toBe(3);
    expect(next.survivor.attack).toBe(7); // 6 + 1
  });
});

describe('canAttack / readyCreatures (summoning sickness)', () => {
  const creature = (over = {}) => ({ type: 'action', attack: 2, defense: 2, ...over });

  it('a creature played this turn cannot attack', () => {
    expect(canAttack(creature({ summoningSick: true }))).toBe(false);
  });

  it('a settled creature that has not swung yet can attack', () => {
    expect(canAttack(creature())).toBe(true);
    expect(canAttack(creature({ summoningSick: false, hasAttacked: false }))).toBe(true);
  });

  it('a creature that already swung this turn cannot attack again', () => {
    expect(canAttack(creature({ hasAttacked: true }))).toBe(false);
  });

  it('traps never attack, however their flags happen to be set', () => {
    expect(canAttack({ type: 'trap', hasAttacked: false, summoningSick: false })).toBe(false);
  });

  it('readyCreatures lifts both flags together, so last turn\'s arrivals can swing', () => {
    const field = [
      creature({ instanceId: 'a', summoningSick: true }),
      creature({ instanceId: 'b', hasAttacked: true }),
      creature({ instanceId: 'c', summoningSick: true, hasAttacked: true }),
    ];
    const ready = readyCreatures(field);
    expect(ready.every(canAttack)).toBe(true);
  });

  it('readyCreatures does not mutate the field it is given', () => {
    const sick = creature({ summoningSick: true });
    const field = [sick];
    readyCreatures(field);
    expect(sick.summoningSick).toBe(true);
    expect(field[0]).toBe(sick);
  });

  it('readyCreatures preserves everything else on the card', () => {
    const [out] = readyCreatures([
      creature({ instanceId: 'x', currentHp: 3, furyStacks: 2, attack: 5, summoningSick: true }),
    ]);
    expect(out.instanceId).toBe('x');
    expect(out.currentHp).toBe(3);
    expect(out.furyStacks).toBe(2);
    expect(out.attack).toBe(5);
  });

  // The full lifecycle the board relies on: arrive sick, sit out a turn, swing
  // once, then be spent until the next turn boundary.
  it('a creature arrives sick, swings next turn, then is spent until the turn after', () => {
    let card = { ...creature(), summoningSick: true }; // played
    expect(canAttack(card)).toBe(false);

    [card] = readyCreatures([card]); // player's next turn begins
    expect(canAttack(card)).toBe(true);

    card = { ...card, hasAttacked: true }; // it swings
    expect(canAttack(card)).toBe(false);

    [card] = readyCreatures([card]); // and the turn after
    expect(canAttack(card)).toBe(true);
  });

  // Rally is a stat pump, not a wake-up: it must not smuggle a freshly played
  // creature into attacking the turn it arrived.
  it('rallyField does not clear summoning sickness', () => {
    const [rallied] = rallyField([creature({ summoningSick: true, currentHp: 1 })]);
    expect(rallied.summoningSick).toBe(true);
    expect(canAttack(rallied)).toBe(false);
    expect(rallied.attack).toBe(3); // rally's +1 still applies
  });
});

describe('getValidTargets (taunt > protect > all, stealth excluded)', () => {
  const C = (over) => ({ type: 'action', ability: 'none', ...over });

  it('returns every non-trap creature when no keyword is present', () => {
    const field = [C({ instanceId: 'a' }), C({ instanceId: 'b' }), { type: 'trap', instanceId: 't' }];
    expect(getValidTargets([], field).map((c) => c.instanceId)).toEqual(['a', 'b']);
  });

  it('restricts to taunt creatures when any taunt is present', () => {
    const field = [C({ instanceId: 'a' }), C({ instanceId: 'taunt', ability: 'taunt' }), C({ instanceId: 'prot', ability: 'protect' })];
    expect(getValidTargets([], field).map((c) => c.instanceId)).toEqual(['taunt']);
  });

  it('taunt outranks protect: with both present, only taunt is targetable', () => {
    const field = [C({ instanceId: 'prot', ability: 'protect' }), C({ instanceId: 'taunt', ability: 'taunt' })];
    expect(getValidTargets([], field).map((c) => c.instanceId)).toEqual(['taunt']);
  });

  it('restricts to protect creatures when protect but no taunt is present', () => {
    const field = [C({ instanceId: 'a' }), C({ instanceId: 'prot', ability: 'protect' })];
    expect(getValidTargets([], field).map((c) => c.instanceId)).toEqual(['prot']);
  });

  it('excludes a stealthed creature at every level, including a stealthed taunt', () => {
    // A stealthed taunt is not a valid target, and because it is filtered out
    // BEFORE the taunt check, it also does not lock targeting onto itself —
    // the rest of the board stays attackable.
    const field = [C({ instanceId: 'a' }), C({ instanceId: 'sneaky', ability: 'taunt', stealthActive: true })];
    expect(getValidTargets([], field).map((c) => c.instanceId)).toEqual(['a']);
  });

  it('never returns traps', () => {
    const field = [{ type: 'trap', instanceId: 't', ability: 'none' }];
    expect(getValidTargets([], field)).toEqual([]);
  });
});

describe('gainedFuryStack — the battle log must not claim +1 at the cap', () => {
  // Fury caps at +3. The log announced "+1 attack" on every survived hit
  // regardless, so a capped creature looked like it was still snowballing and
  // players kept avoiding a creature that had become free to chip at.
  const furyAt = (stacks) => ({ ability: 'fury', attack: 3 + stacks, furyStacks: stacks });

  it('is true while stacks are still growing', () => {
    for (const prior of [0, 1, 2]) {
      const target = furyAt(prior);
      const { survivor } = resolveCreatureHit(
        { attack: 1, ability: 'none' },
        { ...target, defense: 10, currentHp: 10 },
        []
      );
      expect(gainedFuryStack(target, survivor), `prior=${prior}`).toBe(true);
    }
  });

  it('is false once the +3 cap is reached, when attack no longer moves', () => {
    const target = { ...furyAt(3), defense: 10, currentHp: 10 };
    const { survivor } = resolveCreatureHit({ attack: 1, ability: 'none' }, target, []);
    expect(survivor.attack).toBe(target.attack); // the cap really is a no-op
    expect(gainedFuryStack(target, survivor)).toBe(false);
  });

  it('is false for a creature without fury', () => {
    const target = { ability: 'none', attack: 3, defense: 10, currentHp: 10 };
    const { survivor } = resolveCreatureHit({ attack: 1, ability: 'none' }, target, []);
    expect(gainedFuryStack(target, survivor)).toBe(false);
  });
});
