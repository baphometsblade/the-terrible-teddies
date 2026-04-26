// calculateDamage has been consolidated into battleUtils.js
// Import it from there: import { calculateDamage } from './battleUtils';

export const calculateExperience = (winner, loser) => {
  const baseXP = 10;
  const levelDifference = loser.level - winner.level;
  const experienceGain = baseXP + (levelDifference * 2);
  return Math.max(1, experienceGain);
};

export const levelUp = (teddy, experience) => {
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