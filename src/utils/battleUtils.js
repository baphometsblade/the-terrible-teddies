/**
 * Canonical damage calculation function for all battle systems.
 *
 * @param {Object} attacker - The attacking entity (card/teddy)
 * @param {Object} defender - The defending entity (card/teddy)
 * @param {Object} options - Optional modifiers for damage calculation
 * @param {Object} [options.weatherEffect] - Weather effect object with 'name' property
 * @param {boolean} [options.isCritical=false] - Whether this is a critical hit
 * @param {number} [options.defenseBoost=0] - Additional defense boost to apply
 * @param {boolean} [options.useRandomFactor=false] - Whether to apply randomness (0.9-1.1)
 * @returns {number} The calculated damage (minimum 0)
 */
export const calculateDamage = (attacker, defender, options = {}) => {
  const {
    weatherEffect = null,
    isCritical = false,
    defenseBoost = 0,
    useRandomFactor = false,
  } = options;

  let damage = attacker.attack;

  // Handle piercing ability - ignores defense
  if (attacker.ability !== 'piercing') {
    const totalDefense = defender.defense + defenseBoost;
    damage = damage - totalDefense;
  }

  // Handle shield ability - reduces damage by 50%
  if (defender.ability === 'shield') {
    damage = Math.floor(damage / 2);
  }

  // Apply weather effects
  if (weatherEffect) {
    if (weatherEffect.name === 'Sunny Day') {
      damage *= 1.2; // 20% damage boost in sunny weather
    } else if (weatherEffect.name === 'Rainy Day') {
      damage *= 0.8; // 20% damage reduction in rainy weather
    }
  }

  // Apply critical hit
  if (isCritical) {
    damage *= 1.5; // 50% damage boost for critical hits
  }

  // Apply random factor if enabled
  if (useRandomFactor) {
    const randomFactor = Math.random() * 0.2 + 0.9; // Random factor between 0.9 and 1.1
    damage *= randomFactor;
  }

  return Math.max(0, Math.floor(damage));
};

/**
 * Simplified damage calculation for card-based battles (GameBoard).
 * Handles piercing and shield abilities.
 *
 * @param {Object} attacker - The attacking card
 * @param {Object} defender - The defending card
 * @returns {number} The calculated damage (minimum 0)
 */
export const calculateCardDamage = (attacker, defender) => {
  return calculateDamage(attacker, defender, {});
};

export const rollForCritical = (teddy, criticalChanceBoost = 0) => {
  const criticalChance = (teddy.criticalChance || 5) + criticalChanceBoost; // Default 5% critical chance if not specified
  return Math.random() * 100 < criticalChance;
};

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