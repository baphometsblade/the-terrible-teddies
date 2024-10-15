import React from 'react';
import { motion } from 'framer-motion';
import { Button } from "@/components/ui/button";

const BattleRewards = ({ showRewards, setShowRewards }) => {
  if (!showRewards) return null;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.8 }}
      className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50"
    >
      <div className="bg-white p-6 rounded-lg shadow-xl">
        <h2 className="text-2xl font-bold mb-4">Battle Rewards</h2>
        <p>XP Gained: 10</p>
        <p>Coins Earned: 50</p>
        <Button onClick={() => setShowRewards(false)} className="mt-4">Close</Button>
      </div>
    </motion.div>
  );
};

export default BattleRewards;