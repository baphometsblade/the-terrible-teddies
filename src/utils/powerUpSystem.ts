import { PowerUp, BattleState } from '../types/types';

export const generatePowerUps = (): PowerUp[] => {
  return [
    {
      id: '1',
      name: 'Energy Boost',
      description: 'Gain 2 extra energy this turn',
      effect: (state: BattleState) => ({ ...state, playerEnergy: state.playerEnergy + 2 }),
    },
    {
      id: '2',
      name: 'Healing Touch',
      description: 'Restore 10 health points',
      effect: (state: BattleState) => ({ ...state, playerHealth: Math.min(state.playerHealth + 10, 100) }),
    },
    {
      id: '3',
      name: 'Attack Surge',
      description: 'Increase attack by 3 for 2 turns',
      effect: (state: BattleState) => ({ ...state, playerAttackBoost: (state.playerAttackBoost || 0) + 3, playerAttackBoostDuration: 2 }),
    },
  ];
};

export const applyPowerUp = (powerUp: PowerUp, battleState: BattleState): BattleState => {
  return powerUp.effect(battleState);
};