export const checkForCombo = (moveHistory) => {
  const combos = {
    'attack,attack,attack': { name: 'Triple Strike', multiplier: 1.5 },
    'defend,defend,attack': { name: 'Counter Strike', multiplier: 2 },
    'special,special,attack': { name: 'Ultimate Combo', multiplier: 3 },
  };

  const lastThreeMoves = moveHistory.slice(-3).join(',');
  return combos[lastThreeMoves] || null;
};

export const applyCombo = (damage, combo) => {
  return Math.floor(damage * combo.multiplier);
};