import { PowerUp, BattleState } from '../types/types';

const powerUpPool: PowerUp[] = [
  {
    id: '1',
    name: 'Energy Boost',
    description: 'Gain 2 extra energy this turn',
    effect: (state: BattleState) => ({ ...state, playerEnergy: state.playerEnergy + 2 }),
  },
  {
    id: '2',
    name: 'Healing Touch',
    description: 'Restore 20 health points',
    effect: (state: BattleState) => ({ ...state, playerHealth: Math.min(state.playerHealth + 20, 100) }),
  },
  {
    id: '3',
    name: 'Attack Surge',
    description: 'Increase attack by 5 for 2 turns',
    effect: (state: BattleState) => ({ ...state, playerAttackBoost: (state.playerAttackBoost || 0) + 5, playerAttackBoostDuration: 2 }),
  },
  {
    id: '4',
    name: 'Defense Shield',
    description: 'Increase defense by 5 for 2 turns',
    effect: (state: BattleState) => ({ ...state, playerDefenseBoost: (state.playerDefenseBoost || 0) + 5, playerDefenseBoostDuration: 2 }),
  },
  {
    id: '5',
    name: 'Combo Master',
    description: 'Fill the combo meter by 50%',
    effect: (state: BattleState) => ({ ...state, comboMeter: Math.min(state.comboMeter + 50, 100) }),
  },
];

export const generatePowerUps = (count: number): PowerUp[] => {
  const shuffled = [...powerUpPool].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, count);
};

export const applyPowerUp = (powerUp: PowerUp, battleState: BattleState): BattleState => {
  return powerUp.effect(battleState);
};