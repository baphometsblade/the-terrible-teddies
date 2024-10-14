export const calculateDamage = (attacker, defender) => {
  const baseDamage = attacker.attack - defender.defense;
  const randomFactor = Math.random() * 0.4 + 0.8; // Random factor between 0.8 and 1.2
  return Math.max(0, Math.floor(baseDamage * randomFactor));
};

export const applyPowerUp = (teddy) => {
  const powerUps = [
    { name: "Attack Boost", effect: (t) => ({ ...t, attack: t.attack * 1.5 }) },
    { name: "Defense Boost", effect: (t) => ({ ...t, defense: t.defense * 1.5 }) },
    { name: "Health Restore", effect: (t, health, setHealth) => { setHealth(Math.min(100, health + 30)); return t; } },
  ];
  const powerUp = powerUps[Math.floor(Math.random() * powerUps.length)];
  return { name: powerUp.name, effect: powerUp.effect(teddy) };
};

export const checkForCombo = (moveHistory) => {
  const combos = [
    { name: "Double Strike", pattern: ['attack', 'attack'] },
    { name: "Defensive Stance", pattern: ['defend', 'defend'] },
    { name: "Power Surge", pattern: ['special', 'special'] },
  ];
  
  const lastTwoMoves = moveHistory.slice(-2);
  return combos.find(combo => JSON.stringify(combo.pattern) === JSON.stringify(lastTwoMoves));
};