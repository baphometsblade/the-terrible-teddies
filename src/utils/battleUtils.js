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
 * Summoning sickness: a creature cannot attack on the turn it is played,
 * unless it is Quickie (rush). Rush still cannot reach the face that turn
 * (see canSwingFace). Sickness is stamped on arrival and cleared by
 * readyCreatures() at the controller's next turn boundary.
 *
 * The rule exists because without it, taunt and protect barely mattered: any
 * blocker could be answered by playing a fresh creature and swinging with it
 * the same turn. Rush is the one exception, and it is priced for it.
 *
 * @param {object} card
 * @returns {boolean} whether `card` may declare an attack right now
 */
export const canAttack = (card) =>
  card.type === 'action' && !card.hasAttacked && !card.hungover
  && (!card.summoningSick || card.ability === 'rush');

/**
 * A face swing (or the trap it springs) needs a settled attacker. Quickie
 * (rush) may hit creatures the turn it arrives, and only creatures: the
 * owner's face is off limits until the sickness lifts.
 */
export const canSwingFace = (card) =>
  canAttack(card) && !(card.summoningSick && card.ability === 'rush');

/**
 * Clear the per-turn attack flags on a field, readying every creature for its
 * controller's next turn: `hasAttacked` (spent this turn) and `summoningSick`
 * (arrived this turn) both lift together.
 *
 * Applied to the whole field, traps included, so the shape of a card on the
 * field never depends on which flags happen to have been stamped on it.
 */
export const readyCreatures = (field) =>
  field.map((c) => ({
    ...c,
    hasAttacked: false,
    summoningSick: false,
    // A Hungover bear sits out the turn after it swings, then wakes up.
    hungover: !!c.pendingHangover,
    pendingHangover: false,
  }));

/** Stamp a swing. Hungover bears book the morning after. */
export const stampSwing = (card) => ({
  ...card,
  hasAttacked: true,
  ...(card?.ability === 'hungover' ? { pendingHangover: true } : {}),
});

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
const friendOn = (card, field, pred) => field.some((c) => !isSameCard(c, card) && pred(c));

export const effectiveAttack = (card, field = []) => {
  const royal = friendOn(card, field, (c) => c.ability === 'royal' && c.type === 'action');
  const smitten = card.ability === 'smitten' && friendOn(card, field, (c) => c.type === 'action');
  const table = card.tribe && friendOn(card, field, (c) => c.type === 'action' && c.tribe === card.tribe);
  return card.attack + (royal ? 1 : 0) + (smitten ? 1 : 0) + (table ? 1 : 0);
};

/** Why the attack badge is up, for the card's words. Empty when it is not. */
export const attackAuraNote = (card, field = []) => {
  const notes = [];
  if (friendOn(card, field, (c) => c.ability === 'royal' && c.type === 'action')) notes.push('a Patron');
  if (card.ability === 'smitten' && friendOn(card, field, (c) => c.type === 'action')) notes.push('company');
  if (card.tribe && friendOn(card, field, (c) => c.type === 'action' && c.tribe === card.tribe)) notes.push('the table');
  return notes.join(' and ');
};

/** Blackout picks for itself. `random` is in [0, 1). */
export const pickBlackoutTarget = (targets, random = Math.random) => {
  if (!targets?.length) return null;
  const i = Math.min(targets.length - 1, Math.floor(random() * targets.length));
  return targets[i];
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
export const damageToCreatureHp = (attacker, target, attackerField, bonus = 0) => {
  let dmg = attackerField ? effectiveAttack(attacker, attackerField) : attacker.attack;
  if (target.ability === 'shield' && attacker.ability !== 'piercing') {
    dmg = Math.floor(dmg / 2);
  }
  return Math.max(0, dmg + (bonus || 0));
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
export const resolveCreatureHit = (attacker, target, attackerField, bonus = 0) => {
  const dmg = damageToCreatureHp(attacker, target, attackerField, bonus);
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
 * Did this hit actually grow the target's fury bonus?
 *
 * Fury caps at +3 (see resolveCreatureHit above), so from the fourth survived
 * hit onward the creature's attack does not move. The battle log used to
 * announce "+1 attack" on every single survive regardless, telling the player
 * a capped creature was still snowballing — which is exactly the misreading
 * that makes people stop chipping at it when chipping has become free.
 *
 * Pure, and takes both sides of the hit so callers don't re-derive the cap.
 */
export const gainedFuryStack = (target, survivor) =>
  target?.ability === 'fury' && (survivor?.furyStacks ?? 0) > (target?.furyStacks ?? 0);

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

/**
 * Valid attack targets on a defending field, honouring the targeting keywords.
 *
 * Precedence, highest first:
 *   - taunt:   if any taunt creature is present, ONLY taunt creatures may be
 *              targeted.
 *   - protect: else if any protect creature is present, ONLY those may be
 *              targeted (the protector shields the rest of the board).
 *   - else every non-trap, non-stealthed creature is fair game.
 * Traps are never targets (they spring on their own), and a stealthed creature
 * is excluded at every level — it cannot be targeted for the turn it is hidden.
 *
 * Pure and symmetric: both the player (attacking Chuck) and the opponent AI
 * call this with their own/opponent fields. Extracted from GameBoard so the
 * precedence chain — which is what taunt/protect actually MEAN — can be
 * unit-tested; the first argument is unused today but kept so existing
 * two-argument call sites don't change.
 */
export const getValidTargets = (_attackerField, defenderField) => {
  const creatures = defenderField.filter((c) => c.type !== 'trap' && !c.stealthActive);
  const taunts = creatures.filter((c) => c.ability === 'taunt');
  if (taunts.length > 0) return taunts;
  const protectors = creatures.filter((c) => c.ability === 'protect');
  if (protectors.length > 0) return protectors;
  return creatures;
};

/**
 * Why can't this target be attacked? Returns `{ title, description }` for the
 * toast, or null if the target is in fact legal.
 *
 * Kept beside getValidTargets, and deliberately mirrors its precedence chain
 * (traps and stealth first, then taunt, then protect), because a reason that
 * disagrees with the rule is worse than no reason: it teaches the player a
 * rule the engine does not implement. Pure, so the two can be tested against
 * each other — every field getValidTargets rejects must produce a reason here.
 */
export const describeBlockedTarget = (target, defenderField) => {
  // Legality is decided by getValidTargets and nowhere else, so the two can
  // never drift: this function only picks the wording once that call has
  // already ruled the target out. Deciding legality here independently is the
  // trap — an earlier draft tested for each blocker on its own and told a
  // player tapping a legal taunt that it was "Protected!", because a
  // protector was also on the board and the precedence chain was not being
  // honoured.
  if (getValidTargets(null, defenderField).some((c) => isSameCard(c, target))) return null;

  if (target.type === 'trap') {
    return {
      title: "That's a trap, not a target",
      description: `${target.name} springs on its own — go for the face and set it off.`,
    };
  }
  if (target.stealthActive) {
    return {
      title: 'Can\u2019t see it, can\u2019t hit it',
      description: `${target.name} is in stealth this turn. Try again once it shows itself.`,
    };
  }

  const creatures = defenderField.filter((c) => c.type !== 'trap' && !c.stealthActive);

  const taunt = creatures.find((c) => c.ability === 'taunt');
  if (taunt) {
    return {
      title: 'Slap the taunt first',
      description: `${taunt.name} is taunting you — nobody else until it's down.`,
    };
  }

  const protector = creatures.find((c) => c.ability === 'protect');
  if (protector) {
    return {
      title: 'Protection racket',
      description: `${protector.name} is shielding the rest. Go through it first.`,
    };
  }

  return null;
};
