const comboMoves = {
  'attack-attack': {
    name: 'Double Strike',
    description: 'Perform two quick attacks in succession',
    effect: (attacker, defender) => {
      const damage = attacker.attack * 1.5;
      defender.health -= damage;
      return `${attacker.name} unleashes a Double Strike, dealing ${damage} damage!`;
    }
  },
  'defend-attack': {
    name: 'Counter Strike',
    description: 'Block an incoming attack and counter with a powerful blow',
    effect: (attacker, defender) => {
      attacker.defense += 2;
      const damage = attacker.attack * 1.2;
      defender.health -= damage;
      return `${attacker.name} performs a Counter Strike, increasing defense by 2 and dealing ${damage} damage!`;
    }
  },
  'special-attack': {
    name: 'Empowered Assault',
    description: 'Channel energy into a devastating attack',
    effect: (attacker, defender) => {
      const damage = attacker.attack * 2;
      defender.health -= damage;
      return `${attacker.name} launches an Empowered Assault, dealing a massive ${damage} damage!`;
    }
  }
};

export const checkForCombo = (moves) => {
  if (moves.length < 2) return null;
  const comboKey = `${moves[moves.length - 2]}-${moves[moves.length - 1]}`;
  return comboMoves[comboKey] || null;
};

export const applyComboEffect = (combo, attacker, defender) => {
  return combo.effect(attacker, defender);
};