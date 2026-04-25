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