import { TeddyCard } from '../types/types';

export interface Achievement {
  id: string;
  name: string;
  description: string;
  isUnlocked: boolean;
  progress: number;
  maxProgress: number;
}

const achievements: Achievement[] = [
  {
    id: 'firstWin',
    name: 'First Victory',
    description: 'Win your first battle',
    isUnlocked: false,
    progress: 0,
    maxProgress: 1,
  },
  {
    id: 'levelMaster',
    name: 'Level Master',
    description: 'Level up a teddy to level 5',
    isUnlocked: false,
    progress: 0,
    maxProgress: 5,
  },
  {
    id: 'comboKing',
    name: 'Combo King',
    description: 'Perform 10 combos',
    isUnlocked: false,
    progress: 0,
    maxProgress: 10,
  },
];

export const checkAchievements = (
  currentAchievements: Achievement[],
  playerTeddies: TeddyCard[],
  battleWon: boolean,
  combosPerformed: number
): Achievement[] => {
  const updatedAchievements = [...currentAchievements];

  // Check for first win
  const firstWinAchievement = updatedAchievements.find(a => a.id === 'firstWin');
  if (firstWinAchievement && !firstWinAchievement.isUnlocked && battleWon) {
    firstWinAchievement.isUnlocked = true;
    firstWinAchievement.progress = 1;
  }

  // Check for level master
  const levelMasterAchievement = updatedAchievements.find(a => a.id === 'levelMaster');
  if (levelMasterAchievement) {
    const highestLevel = Math.max(...playerTeddies.map(t => t.level));
    levelMasterAchievement.progress = Math.min(highestLevel, levelMasterAchievement.maxProgress);
    if (levelMasterAchievement.progress === levelMasterAchievement.maxProgress) {
      levelMasterAchievement.isUnlocked = true;
    }
  }

  // Check for combo king
  const comboKingAchievement = updatedAchievements.find(a => a.id === 'comboKing');
  if (comboKingAchievement) {
    comboKingAchievement.progress = Math.min(comboKingAchievement.progress + combosPerformed, comboKingAchievement.maxProgress);
    if (comboKingAchievement.progress === comboKingAchievement.maxProgress) {
      comboKingAchievement.isUnlocked = true;
    }
  }

  return updatedAchievements;
};

export const getInitialAchievements = (): Achievement[] => {
  return achievements.map(achievement => ({ ...achievement }));
};