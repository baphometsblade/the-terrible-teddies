const achievements = [
  { name: "First Blood", condition: (action, damage) => action === 'attack' && damage > 0 },
  { name: "Defensive Master", condition: (action) => action === 'defend' },
  { name: "Special Move Unleashed", condition: (action) => action === 'special' },
  { name: "Close Call", condition: (_, __, playerHealth) => playerHealth < 10 },
  { name: "Flawless Victory", condition: (_, __, playerHealth, opponentHealth) => playerHealth === 100 && opponentHealth === 0 },
  { name: "Combo King", condition: (action, _, __, ___, comboCount) => comboCount >= 3 },
  { name: "Power Overwhelming", condition: (action, _, __, ___, ___, powerUpCount) => powerUpCount >= 3 },
  { name: "Underdog", condition: (_, __, playerHealth, opponentHealth) => playerHealth < opponentHealth / 2 && opponentHealth === 0 },
];

export const checkAchievements = (action, damage, playerHealth, opponentHealth, comboCount, powerUpCount) => {
  return achievements.filter(achievement => 
    achievement.condition(action, damage, playerHealth, opponentHealth, comboCount, powerUpCount)
  );
};

export const getAchievementProgress = (unlockedAchievements) => {
  return achievements.map(achievement => ({
    ...achievement,
    unlocked: unlockedAchievements.includes(achievement.name),
  }));
};