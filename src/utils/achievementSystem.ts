import { BattleState } from '../types/types';

export type Achievement = {
  id: string;
  name: string;
  description: string;
  condition: (state: BattleState) => boolean;
};

const achievements: Achievement[] = [
  {
    id: 'first_blood',
    name: 'First Blood',
    description: 'Deal damage to your opponent for the first time',
    condition: (state) => state.opponentHealth < 100,
  },
  {
    id: 'combo_master',
    name: 'Combo Master',
    description: 'Perform a combo move',
    condition: (state) => state.comboMeter === 0 && state.moveHistory.length >= 3,
  },
  {
    id: 'survivor',
    name: 'Survivor',
    description: 'Win a battle with less than 10 health remaining',
    condition: (state) => state.opponentHealth === 0 && state.playerHealth <= 10,
  },
  {
    id: 'energy_efficient',
    name: 'Energy Efficient',
    description: 'Win a battle without using any special moves',
    condition: (state) => state.opponentHealth === 0 && !state.moveHistory.includes('special'),
  },
];

export const checkAchievements = (state: BattleState, unlockedAchievements: string[]): string[] => {
  const newAchievements = achievements
    .filter((achievement) => !unlockedAchievements.includes(achievement.id) && achievement.condition(state))
    .map((achievement) => achievement.id);

  return [...unlockedAchievements, ...newAchievements];
};