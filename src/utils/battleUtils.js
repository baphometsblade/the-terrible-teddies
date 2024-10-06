export const calculateDamage = (attacker, defender) => {
  const baseDamage = attacker.attack - defender.defense;
  const randomFactor = Math.random() * 0.2 + 0.9; // Random factor between 0.9 and 1.1
  const criticalHit = Math.random() < 0.1 ? 1.5 : 1; // 10% chance of critical hit
  return Math.max(1, Math.floor(baseDamage * randomFactor * criticalHit));
};

export const calculateSpecialMoveDamage = (attacker) => {
  const baseDamage = attacker.attack * 1.5;
  const randomFactor = Math.random() * 0.3 + 0.85; // Random factor between 0.85 and 1.15
  return Math.max(1, Math.floor(baseDamage * randomFactor));
};

export const calculateDefenseBoost = (defender) => {
  return Math.floor(defender.defense * 0.2); // 20% defense boost
};

export const isActionSuccessful = (successRate) => {
  return Math.random() < successRate;
};