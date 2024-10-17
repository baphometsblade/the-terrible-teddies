import { BattleState } from '../types/types';

export type BattleItem = {
  name: string;
  description: string;
  effect: (state: BattleState, isPlayer: boolean) => BattleState;
};

const battleItems: Record<string, BattleItem> = {
  healingPotion: {
    name: 'Healing Potion',
    description: 'Restores 20 health',
    effect: (state, isPlayer) => {
      const healthKey = isPlayer ? 'playerHealth' : 'opponentHealth';
      const newHealth = Math.min(100, state[healthKey] + 20);
      return {
        ...state,
        [healthKey]: newHealth,
        battleLog: [...state.battleLog, `${isPlayer ? 'Player' : 'Opponent'} uses a Healing Potion and restores 20 health!`],
      };
    },
  },
  energyDrink: {
    name: 'Energy Drink',
    description: 'Restores 2 energy',
    effect: (state, isPlayer) => {
      const energyKey = isPlayer ? 'playerEnergy' : 'opponentEnergy';
      const newEnergy = Math.min(5, state[energyKey] + 2);
      return {
        ...state,
        [energyKey]: newEnergy,
        battleLog: [...state.battleLog, `${isPlayer ? 'Player' : 'Opponent'} uses an Energy Drink and restores 2 energy!`],
      };
    },
  },
  shieldBoost: {
    name: 'Shield Boost',
    description: 'Increases defense by 5 for 3 turns',
    effect: (state, isPlayer) => {
      const defenseBoostKey = isPlayer ? 'playerDefenseBoost' : 'opponentDefenseBoost';
      return {
        ...state,
        [defenseBoostKey]: (state[defenseBoostKey] || 0) + 5,
        battleLog: [...state.battleLog, `${isPlayer ? 'Player' : 'Opponent'} uses a Shield Boost and increases defense by 5 for 3 turns!`],
      };
    },
  },
};

export const getRandomBattleItem = (): BattleItem => {
  const itemKeys = Object.keys(battleItems);
  const randomKey = itemKeys[Math.floor(Math.random() * itemKeys.length)];
  return battleItems[randomKey];
};