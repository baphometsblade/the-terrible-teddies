import { BattleState } from '../types/types';

export const checkAchievements = (state: BattleState, unlockedAchievements: string[]): string[] => {
  const newAchievements: string[] = [];
  
  // First Victory
  if (state.opponentHealth <= 0 && !unlockedAchievements.includes('first_victory')) {
    newAchievements.push('first_victory');
  }

  // Perfect Victory
  if (state.opponentHealth <= 0 && state.playerHealth === 30 && !unlockedAchievements.includes('perfect_win')) {
    newAchievements.push('perfect_win');
  }

  // Combo Master
  if (state.comboCount >= 5 && !unlockedAchievements.includes('combo_master')) {
    newAchievements.push('combo_master');
  }

  // Weather Survivor
  if (state.opponentHealth <= 0 && state.weatherEffect === 'stormy' && !unlockedAchievements.includes('weather_survivor')) {
    newAchievements.push('weather_survivor');
  }

  return newAchievements;
};