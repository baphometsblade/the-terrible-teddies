export const calculateDamage = (attacker, defender, weatherEffect, isCritical = false) => {
  let baseDamage = attacker.attack - defender.defense;
  
  // Apply weather effects
  if (weatherEffect === 'Sunny') {
    baseDamage *= 1.2; // 20% damage boost in sunny weather
  } else if (weatherEffect === 'Rainy') {
    baseDamage *= 0.8; // 20% damage reduction in rainy weather
  }

  // Apply critical hit
  if (isCritical) {
    baseDamage *= 1.5; // 50% damage boost for critical hits
  }

  return Math.max(0, Math.floor(baseDamage));
};

export const rollForCritical = (teddy) => {
  const criticalChance = teddy.criticalChance || 5; // Default 5% critical chance if not specified
  return Math.random() * 100 < criticalChance;
};