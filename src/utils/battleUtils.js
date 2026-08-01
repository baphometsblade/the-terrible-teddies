/**
 * Creature-HP combat model. `defense` is a creature's durability (HP), tracked
 * per board instance as `currentHp`. An attack deals the attacker's `attack` to
 * that HP pool — halved by the defender's `shield` unless the attacker has
 * `piercing` (which cuts through the shield).
 */

// Identity check for aura math: cards on a live field are copies stamped with
// a stable `instanceId`, so two different objects can represent "the same
// card" across renders/updates. Prefer instanceId when both sides have one;
// fall back to reference equality for the ad-hoc plain objects unit tests use.
const isSameCard = (a, b) => {
  if (a.instanceId !== undefined && b.instanceId !== undefined) {
    return a.instanceId === b.instanceId;
  }
  return a === b;
};

/**
 * Energy cost to play a card, accounting for `swarm`: a swarm card is cheaper
 * (1 less energy, minimum 1) once you already control another creature on the
 * field — the idea being a swarm card is only cheap when it's joining an
 * existing mob, not when it's the first thing you play. Non-swarm cards
 * always cost their listed `cost`.
 *
 * @param {object} card - the card being priced (from hand/deck, not yet on field)
 * @param {object[]} field - the player's current field (creatures + traps)
 * @returns {number} the energy actually required to play `card`
 */
export const effectiveCost = (card, field = []) => {
  if (card.ability !== 'swarm') return card.cost;
  const hasAnotherCreature = field.some((c) => !isSameCard(c, card) && c.type === 'action');
  return hasAnotherCreature ? Math.max(1, card.cost - 1) : card.cost;
};

/**
 * A creature's attack including the `royal` aura: a `royal` card grants every
 * OTHER creature on its field +1 attack for as long as it's alive and present.
 * This is computed here, at damage time, rather than mutated onto the ally
 * cards — so the buff appears the instant a royal card is played and vanishes
 * the instant it dies, with no stored "buffed" state that could drift out of
 * sync with whether the royal card is actually still on the field. A royal
 * card never buffs itself, and multiple royals don't stack (the aura is a
 * boolean "is a royal ally present", not a count).
 *
 * @param {object} card - the attacking creature
 * @param {object[]} field - the attacker's own field (creatures + traps)
 * @returns {number} card.attack, plus 1 if a royal ally is present
 */
export const effectiveAttack = (card, field = []) => {
  const hasRoyalAlly = field.some((c) => !isSameCard(c, card) && c.ability === 'royal' && c.type === 'action');
  return card.attack + (hasRoyalAlly ? 1 : 0);
};

/**
 * @param {object} attacker
 * @param {object} target
 * @param {object[]} [attackerField] - optional: the attacker's own field, so
 *   the `royal` aura (see effectiveAttack) is factored into the base damage.
 *   Omit it (as every pre-existing caller does) and this behaves exactly as
 *   before — plain `attacker.attack`, no aura.
 * @returns {number} raw HP damage this hit deals (>= 0)
 */
export const damageToCreatureHp = (attacker, target, attackerField) => {
  let dmg = attackerField ? effectiveAttack(attacker, attackerField) : attacker.attack;
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
 *   outlive a hit). The fury bonus is tracked via `furyStacks` and caps at +3
 *   total: uncapped, it snowballed without bound (especially through Rally,
 *   which heals a fury creature back to full HP without resetting its stacks,
 *   letting it survive indefinitely and grow forever). `overkill` is 0.
 * - Dies (HP <= 0): `survivor` is null and `overkill` is the trample damage that
 *   spills past the creature to the owner's face.
 *
 * @param {object} attacker
 * @param {object} target
 * @param {object[]} [attackerField] - optional: see damageToCreatureHp.
 * @returns {{ survivor: object|null, overkill: number, dmg: number }}
 */
export const resolveCreatureHit = (attacker, target, attackerField) => {
  const dmg = damageToCreatureHp(attacker, target, attackerField);
  const hpBefore = target.currentHp ?? target.defense ?? 0;
  const hpAfter = hpBefore - dmg;

  if (hpAfter > 0) {
    const survivor = { ...target, currentHp: hpAfter };
    if (target.ability === 'fury') {
      // Recompute from a de-furied "base" attack (attack minus the bonus
      // already applied) so the cap is exact no matter how many times this
      // has fired, and so unrelated attack changes (e.g. the 'buff' special,
      // or Rally's permanent +1) are respected as the new base going forward.
      const priorStacks = target.furyStacks ?? 0;
      const stacks = Math.min(3, priorStacks + 1);
      survivor.furyStacks = stacks;
      survivor.attack = target.attack - priorStacks + stacks;
    }
    return { survivor, overkill: 0, dmg };
  }

  return { survivor: null, overkill: Math.max(0, dmg - hpBefore), dmg };
};

/**
 * "Rally" — the momentum payoff. Pump every creature on a field: +1 attack and
 * heal back to full HP (currentHp = defense). Non-creatures (traps) are left
 * untouched. Pure, so the board transform is unit-testable.
 *
 * `furyStacks` is carried over unchanged (via the object spread) rather than
 * reset or bumped — Rally is a separate, permanent +1, not another fury
 * "survive" event, so it must neither erase nor double-count fury's own cap.
 */
export const rallyField = (field) =>
  field.map((c) => (c.type === 'action'
    ? { ...c, attack: c.attack + 1, currentHp: c.defense }
    : c));
