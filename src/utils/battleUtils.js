/**
 * Creature-HP combat model. `defense` is a creature's durability (HP), tracked
 * per board instance as `currentHp`. An attack deals the attacker's `attack` to
 * that HP pool — halved by the defender's `shield` unless the attacker has
 * `piercing` (which cuts through the shield).
 *
 * @returns {number} raw HP damage this hit deals (>= 0)
 */
export const damageToCreatureHp = (attacker, target) => {
  let dmg = attacker.attack;
  if (target.ability === 'shield' && attacker.ability !== 'piercing') {
    dmg = Math.floor(dmg / 2);
  }
  return Math.max(0, dmg);
};

/**
 * Resolve one attack against a creature that has `currentHp` (falling back to
 * `defense` if it hasn't been hit yet). Symmetric for both players.
 *
 * - Survives (HP remains): returns the updated card with reduced `currentHp`,
 *   and — if it has `fury` — +1 attack (fury only matters now that creatures can
 *   outlive a hit). `overkill` is 0.
 * - Dies (HP <= 0): `survivor` is null and `overkill` is the trample damage that
 *   spills past the creature to the owner's face.
 *
 * @returns {{ survivor: object|null, overkill: number, dmg: number }}
 */
export const resolveCreatureHit = (attacker, target) => {
  const dmg = damageToCreatureHp(attacker, target);
  const hpBefore = target.currentHp ?? target.defense ?? 0;
  const hpAfter = hpBefore - dmg;

  if (hpAfter > 0) {
    const survivor = { ...target, currentHp: hpAfter };
    if (target.ability === 'fury') survivor.attack = target.attack + 1;
    return { survivor, overkill: 0, dmg };
  }

  return { survivor: null, overkill: Math.max(0, dmg - hpBefore), dmg };
};

/**
 * "Rally" — the momentum payoff. Pump every creature on a field: +1 attack and
 * heal back to full HP (currentHp = defense). Non-creatures (traps) are left
 * untouched. Pure, so the board transform is unit-testable.
 */
export const rallyField = (field) =>
  field.map((c) => (c.type === 'action'
    ? { ...c, attack: c.attack + 1, currentHp: c.defense }
    : c));
