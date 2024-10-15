import { calculateDamage } from './battleUtils';

const comboMoves = {
  'attack-attack': {
    name: 'Double Strike',
    description: 'Perform two quick attacks in succession',
    effect: (attacker, defender) => {
      const damage = attacker.attack * 1.5;
      return {
        opponentHealth: (prevHealth) => Math.max(0, prevHealth - damage),
        battleLog: [`${attacker.name} unleashes a Double Strike, dealing ${damage} damage!`],
      };
    }
  },
  'defend-attack': {
    name: 'Counter Strike',
    description: 'Block an incoming attack and counter with a powerful blow',
    effect: (attacker, defender) => {
      const damage = attacker.attack * 1.2;
      return {
        playerStatusEffect: 'defended',
        opponentHealth: (prevHealth) => Math.max(0, prevHealth - damage),
        battleLog: [`${attacker.name} performs a Counter Strike, increasing defense and dealing ${damage} damage!`],
      };
    }
  },
  'special-attack': {
    name: 'Empowered Assault',
    description: 'Channel energy into a devastating attack',
    effect: (attacker, defender) => {
      const damage = attacker.attack * 2;
      return {
        opponentHealth: (prevHealth) => Math.max(0, prevHealth - damage),
        battleLog: [`${attacker.name} launches an Empowered Assault, dealing a massive ${damage} damage!`],
      };
    }
  }
};

export const checkForCombo = (moves) => {
  if (moves.length < 2) return null;
  const comboKey = `${moves[moves.length - 2]}-${moves[moves.length - 1]}`;
  return comboMoves[comboKey] || null;
};

export const applyComboEffect = (state, combo, attacker, defender) => {
  const effect = combo.effect(attacker, defender);
  let newState = { ...state };

  if (effect.opponentHealth) {
    newState.opponentHealth = effect.opponentHealth(newState.opponentHealth);
  }
  if (effect.playerStatusEffect) {
    newState.playerStatusEffect = effect.playerStatusEffect;
  }
  newState.battleLog = [...newState.battleLog, ...effect.battleLog];
  newState.moveHistory = [];

  return newState;
};