import { TeddyCard } from '../types/types';

export const calculateExperience = (winner: TeddyCard, loser: TeddyCard): number => {
  const levelDifference = loser.level - winner.level;
  const baseXP = 50;
  return Math.max(10, baseXP + levelDifference * 10);
};

export const levelUp = (teddy: TeddyCard, experience: number): TeddyCard => {
  const newExperience = teddy.experience + experience;
  const experienceThreshold = teddy.level * 100;

  if (newExperience >= experienceThreshold) {
    return {
      ...teddy,
      level: teddy.level + 1,
      attack: teddy.attack + 1,
      defense: teddy.defense + 1,
      experience: newExperience - experienceThreshold,
    };
  }

  return {
    ...teddy,
    experience: newExperience,
  };
};

export const applyBattleResults = (winner: TeddyCard, loser: TeddyCard): TeddyCard => {
  const experience = calculateExperience(winner, loser);
  return levelUp(winner, experience);
};