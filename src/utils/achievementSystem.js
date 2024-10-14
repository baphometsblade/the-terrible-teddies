const achievements = [
  { name: "First Blood", condition: (action, damage) => action === 'attack' && damage > 0 },
  { name: "Defensive Master", condition: (action) => action === 'defend' },
  { name: "Special Move Unleashed", condition: (action) => action === 'special' },
  { name: "Close Call", condition: (_, __, playerHealth) => playerHealth < 10 },
  { name: "Flawless Victory", condition: (_, __, playerHealth, opponentHealth) => playerHealth === 100 && opponentHealth === 0 },
];

export const checkAchievements = (action, damage, playerHealth, opponentHealth) => {
  return achievements.filter(achievement => 
    achievement.condition(action, damage, playerHealth, opponentHealth)
  );
};