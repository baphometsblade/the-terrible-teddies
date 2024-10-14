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
  {
    id: 'unbeatable',
    name: 'Unbeatable',
    description: 'Win a battle without taking any damage',
    check: (battle, action) => battle.status === 'finished' && battle.winner === battle.player1_id && battle.player1_health === 30
  },
  {
    id: 'comeback_kid',
    name: 'Comeback Kid',
    description: 'Win a battle after being below 5 health',
    check: (battle, action) => battle.status === 'finished' && battle.winner === battle.player1_id && battle.player1_lowest_health <= 5
  },
  {
    id: 'fusion_master',
    name: 'Fusion Master',
    description: 'Successfully fuse 10 teddies in the Teddy Lab',
    check: (stats) => stats.fusions_completed >= 10
  },
  {
    id: 'battle_pass_champion',
    name: 'Battle Pass Champion',
    description: 'Complete a full Battle Pass',
    check: (stats) => stats.completed_battle_passes > 0
  },
];

export const checkAchievements = (battle, action, stats) => {
  return achievements.filter(achievement => 
    !stats.unlockedAchievements.includes(achievement.id) && 
    (
      (achievement.check.length === 2 && achievement.check(battle, action)) ||
      (achievement.check.length === 1 && achievement.check(stats))
    )
  );
};

export const getAchievementProgress = (stats) => {
  return achievements.map(achievement => ({
    ...achievement,
    unlocked: stats.unlockedAchievements.includes(achievement.id),
    progress: calculateProgress(achievement, stats)
  }));
};

const calculateProgress = (achievement, stats) => {
  // Implement logic to calculate progress for each achievement type
  // Return a value between 0 and 100
};