import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { Achievement } from '../utils/achievementSystem';
import { useToast } from "@/components/ui/use-toast";

export const useAchievements = (userId: string) => {
  const [currentAchievement, setCurrentAchievement] = useState<Achievement | null>(null);
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
      toast({
        title: "Achievement Unlocked!",
        description: currentAchievement?.title,
        variant: "success",
      });
    }
  });

  const showAchievement = (achievement: Achievement) => {
    setCurrentAchievement(achievement);
    setTimeout(() => setCurrentAchievement(null), 3000);
  };

  return {
    unlockedAchievements,
    unlockAchievement,
    currentAchievement,
    showAchievement
  };
};