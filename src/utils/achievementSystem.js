import { supabase } from '../lib/supabase';

const achievements = [
  {
    id: 'first_win',
    name: 'First Victory',
    description: 'Win your first battle',
    check: (stats) => stats.wins > 0,
  },
  {
    id: 'combo_master',
    name: 'Combo Master',
    description: 'Perform 10 combos in a single battle',
    check: (stats) => stats.combosInBattle >= 10,
  },
  {
    id: 'evolve_teddy',
    name: 'Evolution Complete',
    description: 'Evolve a teddy to its final form',
    check: (stats) => stats.fullyEvolvedTeddies > 0,
  },
  {
    id: 'collector',
    name: 'Teddy Collector',
    description: 'Collect 50 unique teddies',
    check: (stats) => stats.uniqueTeddies >= 50,
  },
  {
    id: 'battle_pass_complete',
    name: 'Season Champion',
    description: 'Complete a Battle Pass',
    check: (stats) => stats.completedBattlePasses > 0,
  },
];

export const checkAchievements = async (userId) => {
  const { data: userStats, error } = await supabase
    .from('user_stats')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (error) {
    console.error('Error fetching user stats:', error);
    return [];
  }

  const newAchievements = achievements.filter(achievement => 
    achievement.check(userStats) && !userStats.achievements.includes(achievement.id)
  );

  if (newAchievements.length > 0) {
    const updatedAchievements = [...userStats.achievements, ...newAchievements.map(a => a.id)];
    const { error: updateError } = await supabase
      .from('user_stats')
      .update({ achievements: updatedAchievements })
      .eq('user_id', userId);

    if (updateError) {
      console.error('Error updating achievements:', updateError);
    }
  }

  return newAchievements;
};