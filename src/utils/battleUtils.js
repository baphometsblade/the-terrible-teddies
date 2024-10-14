export const calculateDamage = (attacker, defender, defenseBoost) => {
  const baseDamage = attacker.attack - (defender.defense + defenseBoost);
  const randomFactor = Math.random() * 0.4 + 0.8; // Random factor between 0.8 and 1.2
  return Math.max(0, Math.floor(baseDamage * randomFactor));
};

export const applyPowerUp = (teddy) => {
  const powerUps = [
    { name: "Attack Boost", effect: (t) => ({ ...t, attack: Math.floor(t.attack * 1.5) }) },
    { name: "Defense Boost", effect: (t) => ({ ...t, defense: Math.floor(t.defense * 1.5) }) },
    { name: "Healing Surge", effect: (t) => ({ ...t, health: Math.min(100, t.health + 30) }) },
  ];
  const powerUp = powerUps[Math.floor(Math.random() * powerUps.length)];
  return { name: powerUp.name, effect: powerUp.effect(teddy) };
};

export const checkForCombo = (moveHistory) => {
  const combos = [
    { name: "Double Strike", pattern: ['attack', 'attack'], effect: (damage) => damage * 1.5 },
    { name: "Defensive Stance", pattern: ['defend', 'defend'], effect: (defenseBoost) => defenseBoost * 2 },
    { name: "Power Surge", pattern: ['special', 'special'], effect: (damage) => damage * 2 },
    { name: "Counter Attack", pattern: ['defend', 'attack'], effect: (damage, defenseBoost) => ({ damage: damage * 1.3, defenseBoost: defenseBoost * 1.5 }) },
  ];
  
  const lastTwoMoves = moveHistory.slice(-2);
  return combos.find(combo => JSON.stringify(combo.pattern) === JSON.stringify(lastTwoMoves));
};

export const applyComboEffect = (combo, attacker, defender) => {
  switch (combo.name) {
    case "Double Strike":
      return { damage: combo.effect(calculateDamage(attacker, defender, 0)) };
    case "Defensive Stance":
      return { defenseBoost: combo.effect(10) }; // Assume base defense boost is 10
    case "Power Surge":
      return { damage: combo.effect(calculateDamage(attacker, defender, 0)) };
    case "Counter Attack":
      const { damage, defenseBoost } = combo.effect(calculateDamage(attacker, defender, 0), 10);
      return { damage, defenseBoost };
    default:
      return {};
  }
};