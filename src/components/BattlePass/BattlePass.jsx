import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { motion } from 'framer-motion';
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";

const BattlePass = () => {
  const { data: battlePass, isLoading, error } = useQuery({
    queryKey: ['battlePass'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('battle_pass')
        .select('*')
        .single();
      if (error) throw error;
      return data;
    },
  });

  if (isLoading) return <div>Loading Battle Pass...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return (
    <motion.div
      className="battle-pass bg-gray-100 p-4 rounded-lg"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <h2 className="text-2xl font-bold mb-4">Battle Pass</h2>
      <div className="mb-4">
        <p>Current Level: {battlePass.currentLevel}</p>
        <Progress value={(battlePass.currentXP / battlePass.levelUpXP) * 100} className="mt-2" />
        <p className="text-sm text-gray-600 mt-1">
          {battlePass.currentXP} / {battlePass.levelUpXP} XP
        </p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {battlePass.rewards.map((reward, index) => (
          <motion.div
            key={index}
            className="reward-card bg-white p-4 rounded-lg shadow"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: index * 0.1 }}
          >
            <h3 className="text-lg font-semibold mb-2">Level {reward.level}</h3>
            <p>{reward.description}</p>
            <Button
              className="mt-2"
              disabled={battlePass.currentLevel < reward.level}
            >
              {battlePass.currentLevel >= reward.level ? 'Claim' : 'Locked'}
            </Button>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
};

export default BattlePass;