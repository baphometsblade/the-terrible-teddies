import { getRandomInt } from './helpers';

export const calculateDamage = (attacker, defender, defenseBoost, isCritical = false) => {
  const baseDamage = attacker.attack - (defender.defense + defenseBoost);
  const randomFactor = Math.random() * 0.4 + 0.8; // Random factor between 0.8 and 1.2
  const criticalMultiplier = isCritical ? 1.5 : 1;
  return Math.max(0, Math.floor(baseDamage * randomFactor * criticalMultiplier));
};

export const applyPowerUp = (teddy) => {
  const powerUps = [
    { name: "Attack Boost", effect: (t) => ({ ...t, attack: Math.floor(t.attack * 1.5) }) },
    { name: "Defense Boost", effect: (t) => ({ ...t, defense: Math.floor(t.defense * 1.5) }) },
    { name: "Healing Surge", effect: (t) => ({ ...t, health: Math.min(100, t.health + 30) }) },
    { name: "Speed Boost", effect: (t) => ({ ...t, speed: Math.floor(t.speed * 1.3) }) },
    { name: "Critical Chance Up", effect: (t) => ({ ...t, criticalChance: t.criticalChance + 10 }) },
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
    { name: "Elemental Fusion", pattern: ['special', 'attack'], effect: (damage) => ({ damage: damage * 1.8, statusEffect: 'elemental' }) },
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
    case "Elemental Fusion":
      const { damage: elementalDamage, statusEffect } = combo.effect(calculateDamage(attacker, defender, 0));
      return { damage: elementalDamage, statusEffect };
    default:
      return {};
  }
};

export const applyStatusEffect = (teddy, effect) => {
  switch (effect) {
    case 'burn':
      return { ...teddy, health: teddy.health - 5, attack: Math.floor(teddy.attack * 0.9) };
    case 'freeze':
      return { ...teddy, speed: Math.floor(teddy.speed * 0.7) };
    case 'poison':
      return { ...teddy, health: teddy.health - 3, defense: Math.floor(teddy.defense * 0.9) };
    case 'elemental':
      return { ...teddy, attack: Math.floor(teddy.attack * 1.2), defense: Math.floor(teddy.defense * 1.2) };
    default:
      return teddy;
  }
};

export const getWeatherEffect = () => {
  const effects = [
    { name: 'Sunny', effect: (teddy) => ({ ...teddy, attack: Math.floor(teddy.attack * 1.1) }) },
    { name: 'Rainy', effect: (teddy) => ({ ...teddy, defense: Math.floor(teddy.defense * 1.1) }) },
    { name: 'Windy', effect: (teddy) => ({ ...teddy, speed: Math.floor(teddy.speed * 1.1) }) },
    { name: 'Stormy', effect: (teddy) => ({ ...teddy, criticalChance: teddy.criticalChance + 5 }) },
  ];
  return effects[Math.floor(Math.random() * effects.length)];
};

export const rollForCritical = (teddy) => {
  return Math.random() * 100 < (teddy.criticalChance || 5); // Default 5% critical chance
};