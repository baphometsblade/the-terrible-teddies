import { BattleState, TeddyCard } from '../types/types';

export interface Achievement {
  id: string;
  title: string;
  description: string;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  condition: (state: BattleState, teddy: TeddyCard) => boolean;
}

export const achievements: Achievement[] = [
  {
    id: 'first_blood',
    title: 'First Blood',
    description: 'Win your first battle',
    rarity: 'common',
    condition: (state) => state.opponentHealth <= 0
  },
  {
    id: 'combo_master',
    title: 'Combo Master',
    description: 'Execute a 3-move combo',
    rarity: 'rare',
    condition: (state) => state.currentCombo.length >= 3
  },
  {
    id: 'elemental_mastery',
    title: 'Elemental Mastery',
    description: 'Deal super effective damage 3 times in one battle',
    rarity: 'epic',
    condition: (state) => {
      const superEffectiveHits = state.battleLog.filter(log => 
        log.includes('Super Effective!')
      ).length;
      return superEffectiveHits >= 3;
    }
  },
  {
    id: 'perfect_victory',
    title: 'Perfect Victory',
    description: 'Win a battle without taking damage',
    rarity: 'legendary',
    condition: (state) => state.opponentHealth <= 0 && state.playerHealth === 30
  }
];

export const checkAchievements = (
  state: BattleState,
  teddy: TeddyCard,
  unlockedAchievements: string[]
): Achievement[] => {
  return achievements.filter(achievement => 
    !unlockedAchievements.includes(achievement.id) &&
    achievement.condition(state, teddy)
  );
};