export const calculateDamage = (attackerAttack, defenderDefense) => {
  const baseDamage = Math.max(0, attackerAttack - defenderDefense);
  const randomFactor = Math.random() * 0.2 + 0.9; // Random factor between 0.9 and 1.1
  return Math.round(baseDamage * randomFactor);
};

export const calculateSpecialMoveDamage = (attackerAttack, defenderDefense, specialMovePower) => {
  const baseDamage = Math.max(0, (attackerAttack * specialMovePower) - defenderDefense);
  const randomFactor = Math.random() * 0.3 + 0.85; // Random factor between 0.85 and 1.15
  return Math.round(baseDamage * randomFactor);
};

export const calculateDefenseBoost = (currentDefense, boostAmount) => {
  return Math.min(currentDefense + boostAmount, currentDefense * 2); // Cap at double the original defense
};

export const isActionSuccessful = (successRate) => {
  return Math.random() < successRate;
};

export const calculateStuffingGain = (baseGain) => {
  const randomFactor = Math.random() * 0.4 + 0.8; // Random factor between 0.8 and 1.2
  return Math.round(baseGain * randomFactor);
};

export const calculateHealAmount = (baseHeal, currentHealth, maxHealth) => {
  const actualHeal = Math.min(baseHeal, maxHealth - currentHealth);
  const randomFactor = Math.random() * 0.2 + 0.9; // Random factor between 0.9 and 1.1
  return Math.round(actualHeal * randomFactor);
};