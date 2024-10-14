import React, { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/components/ui/use-toast";

const BattlePass = () => {
  const [currentLevel, setCurrentLevel] = useState(1);
  const [xp, setXp] = useState(0);
  const { toast } = useToast();

  const { data: battlePassData, isLoading, error } = useQuery({
    queryKey: ['battlePass'],
    queryFn: async () => {
      const { data, error } = await supabase.from('battle_pass').select('*');
      if (error) throw error;
      return data;
    },
  });

  const claimRewardMutation = useMutation({
    mutationFn: async (levelId) => {
      const { data, error } = await supabase
        .from('user_battle_pass')
        .update({ claimed: true })
        .eq('user_id', (await supabase.auth.getUser()).data.user.id)
        .eq('level_id', levelId);
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast({
        title: "Reward Claimed!",
        description: "You've successfully claimed your reward.",
        variant: "success",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Failed to claim reward: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  useEffect(() => {
    const fetchUserBattlePass = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data, error } = await supabase
          .from('user_battle_pass')
          .select('current_level, xp')
          .eq('user_id', user.id)
          .single();
        if (error) {
          console.error('Error fetching user battle pass:', error);
        } else {
          setCurrentLevel(data.current_level);
          setXp(data.xp);
        }
      }
    };
    fetchUserBattlePass();
  }, []);

  if (isLoading) return <div>Loading Battle Pass...</div>;
  if (error) return <div>Error: {error.message}</div>;

  const currentLevelData = battlePassData.find(level => level.level === currentLevel);
  const xpToNextLevel = currentLevelData ? currentLevelData.xp_required - xp : 0;
  const progress = currentLevelData ? (xp / currentLevelData.xp_required) * 100 : 0;

  return (
    <div className="battle-pass p-4 bg-gray-100 rounded-lg">
      <h2 className="text-2xl font-bold mb-4">Battle Pass</h2>
      <div className="current-level mb-4">
        <p>Current Level: {currentLevel}</p>
        <p>XP to Next Level: {xpToNextLevel}</p>
        <Progress value={progress} className="w-full mt-2" />
      </div>
      <div className="rewards grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {battlePassData.map((level) => (
          <div key={level.id} className={`level-reward p-4 border rounded ${currentLevel >= level.level ? 'bg-green-100' : 'bg-gray-200'}`}>
            <h3 className="font-bold">Level {level.level}</h3>
            <p>{level.reward_description}</p>
            <Button
              onClick={() => claimRewardMutation.mutate(level.id)}
              disabled={currentLevel < level.level || level.claimed}
              className="mt-2"
            >
              {level.claimed ? 'Claimed' : 'Claim Reward'}
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default BattlePass;