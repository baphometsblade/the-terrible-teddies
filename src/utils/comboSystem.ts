import { BattleState, TeddyCard } from '../types/types';

const combos = {
  'attack,attack,attack': {
    name: 'Triple Strike',
    effect: (state: BattleState, attacker: TeddyCard) => {
      const damage = attacker.attack * 2;
      return {
        ...state,
        opponentHealth: Math.max(0, state.opponentHealth - damage),
        battleLog: [...state.battleLog, `${attacker.name} unleashes a Triple Strike for ${damage} damage!`],
      };
    },
  },
  'defend,defend,attack': {
    name: 'Counter Strike',
    effect: (state: BattleState, attacker: TeddyCard) => {
      const damage = attacker.attack * 1.5;
      return {
        ...state,
        opponentHealth: Math.max(0, state.opponentHealth - damage),
        playerDefenseBoost: (state.playerDefenseBoost || 0) + 2,
        battleLog: [...state.battleLog, `${attacker.name} performs a Counter Strike, dealing ${damage} damage and increasing defense!`],
      };
    },
  },
};

export const checkForCombo = (moveHistory: string[]): string | null => {
  const lastThreeMoves = moveHistory.slice(-3).join(',');
  return combos[lastThreeMoves] ? lastThreeMoves : null;
};

export const applyCombo = (comboKey: string, state: BattleState, attacker: TeddyCard): BattleState => {
  return combos[comboKey].effect(state, attacker);
};