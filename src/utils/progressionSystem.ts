import { TeddyCard } from '../types/types';

export const upgradeTeddy = (teddy: TeddyCard, wave: number): TeddyCard => {
  const upgradePoints = Math.floor(wave / 3); // Upgrade every 3 waves

  return {
    ...teddy,
    attack: teddy.attack + upgradePoints,
    defense: teddy.defense + upgradePoints,
    health: teddy.health + upgradePoints * 5,
    level: teddy.level + upgradePoints,
    experience: teddy.experience + wave * 100,
  };
};

export const checkLevelUp = (teddy: TeddyCard): TeddyCard => {
  const experienceThreshold = teddy.level * 1000;
  
  if (teddy.experience >= experienceThreshold) {
    return {
      ...teddy,
      level: teddy.level + 1,
      attack: teddy.attack + 2,
      defense: teddy.defense + 2,
      health: teddy.health + 10,
      experience: teddy.experience - experienceThreshold,
    };
  }

  return teddy;
};