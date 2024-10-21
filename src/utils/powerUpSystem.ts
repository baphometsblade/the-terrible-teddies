import { PowerUp, BattleState } from '../types/types';

const powerUps: PowerUp[] = [
  {
    id: '1',
    name: 'Energy Boost',
    description: 'Restore 2 energy',
    effect: (state: BattleState) => ({
      ...state,
      playerEnergy: Math.min(state.playerEnergy + 2, 5),
      battleLog: [...state.battleLog, `${state.playerTeddy.name} restored 2 energy!`]
    })
  },
  {
    id: '2',
    name: 'Healing Potion',
    description: 'Restore 5 health',
    effect: (state: BattleState) => ({
      ...state,
      playerHealth: Math.min(state.playerHealth + 5, 20),
      battleLog: [...state.battleLog, `${state.playerTeddy.name} restored 5 health!`]
    })
  },
  {
    id: '3',
    name: 'Attack Boost',
    description: 'Increase attack by 2 for 3 turns',
    effect: (state: BattleState) => ({
      ...state,
      playerAttackBoost: state.playerAttackBoost + 2,
      playerAttackBoostDuration: 3,
      battleLog: [...state.battleLog, `${state.playerTeddy.name}'s attack increased by 2 for 3 turns!`]
    })
  }
];

export const generatePowerUps = (count: number): PowerUp[] => {
  const shuffled = [...powerUps].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, count);
};

export const applyPowerUp = (powerUp: PowerUp, state: BattleState): Partial<BattleState> => {
  return powerUp.effect(state);
};