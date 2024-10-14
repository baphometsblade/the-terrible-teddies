import React from 'react';
import { useMutation } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { motion } from 'framer-motion';

const BattleRewards = ({ battle }) => {
  const { toast } = useToast();

  const claimRewardsMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc('claim_battle_rewards', { battle_id: battle.id });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      toast({
        title: "Rewards Claimed",
        description: `You've received ${data.coins} coins and ${data.experience} XP!`,
        variant: "success",
      });
    },
    onError: (error) => {
      toast({
        title: "Failed to Claim Rewards",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  return (
    <motion.div
      className="battle-rewards p-4 bg-yellow-100 rounded-lg mt-4"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <h2 className="text-2xl font-bold mb-2">Battle Rewards</h2>
      <p className="mb-4">Congratulations on completing the battle! Claim your rewards below:</p>
      <Button
        onClick={() => claimRewardsMutation.mutate()}
        disabled={claimRewardsMutation.isLoading}
        className="w-full"
      >
        {claimRewardsMutation.isLoading ? 'Claiming...' : 'Claim Rewards'}
      </Button>
    </motion.div>
  );
};

export default BattleRewards;