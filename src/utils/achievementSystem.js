const achievements = [
  {
    id: 'first_blood',
    name: 'First Blood',
    description: 'Win your first battle',
    check: (battle, action) => battle.status === 'finished' && battle.winner === battle.player1_id
  },
  {
    id: 'combo_master',
    name: 'Combo Master',
    description: 'Perform a 3-hit combo',
    check: (battle, action) => action === 'combo' && battle.combo_count >= 3
  },
  {
    id: 'power_overwhelming',
    name: 'Power Overwhelming',
    description: 'Use a power-up 3 times in a single battle',
    check: (battle, action) => action === 'power_up' && battle.power_up_count >= 3
  },
  // Add more achievements as needed
];

export const checkAchievements = (battle, action) => {
  return achievements.filter(achievement => 
    !battle.player1.achievements.includes(achievement.id) && 
    achievement.check(battle, action)
  );
};