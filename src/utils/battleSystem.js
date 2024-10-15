export const calculateDamage = (attacker, defender) => {
  const baseDamage = attacker.attack - defender.defense / 2;
  const randomFactor = Math.random() * 0.2 + 0.9; // Random factor between 0.9 and 1.1
  return Math.max(1, Math.floor(baseDamage * randomFactor));
};

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