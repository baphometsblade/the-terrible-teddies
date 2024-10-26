import React, { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { useToast } from "@/components/ui/use-toast";
import { Achievement, BattleState } from '../../types/types';
import AchievementList from './AchievementList';
import { checkAchievements } from '../../utils/achievementSystem';

interface AchievementTrackerProps {
  battleState: BattleState;
  userId: string;
}

const AchievementTracker: React.FC<AchievementTrackerProps> = ({ battleState, userId }) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: unlockedAchievements } = useQuery({
    queryKey: ['achievements', userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('player_achievements')
        .select('achievement_id')
        .eq('player_id', userId);
      
      if (error) throw error;
      return data.map(a => a.achievement_id);
    }
  });

  const unlockAchievement = useMutation({
    mutationFn: async (achievementId: string) => {
      const { error } = await supabase
        .from('player_achievements')
        .insert([{ player_id: userId, achievement_id: achievementId }]);
      
      if (error) throw error;
    },
    onSuccess: (_, achievementId) => {
      queryClient.invalidateQueries({ queryKey: ['achievements', userId] });
      const achievement = achievements.find(a => a.id === achievementId);
      if (achievement) {
        toast({
          title: "Achievement Unlocked!",
          description: achievement.title,
          variant: "success",
        });
      }
    }
  });

  const achievements: Achievement[] = [
    {
      id: 'first_victory',
      title: 'First Victory',
      description: 'Win your first battle',
      rarity: 'common',
      condition: (state) => state.opponentHealth <= 0
    },
    {
      id: 'perfect_win',
      title: 'Perfect Victory',
      description: 'Win a battle without taking any damage',
      rarity: 'legendary',
      condition: (state) => state.opponentHealth <= 0 && state.playerHealth === 30
    },
    {
      id: 'combo_master',
      title: 'Combo Master',
      description: 'Execute a 5-hit combo',
      rarity: 'epic',
      condition: (state) => state.comboCount >= 5
    },
    {
      id: 'weather_survivor',
      title: 'Weather the Storm',
      description: 'Win a battle during stormy weather',
      rarity: 'rare',
      condition: (state) => state.opponentHealth <= 0 && state.weatherEffect === 'stormy'
    }
  ];

  useEffect(() => {
    if (unlockedAchievements) {
      const newAchievements = checkAchievements(battleState, unlockedAchievements);
      newAchievements.forEach(achievement => {
        unlockAchievement.mutate(achievement.id);
      });
    }
  }, [battleState, unlockedAchievements]);

  if (!unlockedAchievements) return null;

  return (
    <div className="achievement-tracker p-4">
      <h2 className="text-2xl font-bold mb-4">Achievements</h2>
      <AchievementList 
        achievements={achievements}
        unlockedAchievements={unlockedAchievements}
      />
    </div>
  );
};

export default AchievementTracker;