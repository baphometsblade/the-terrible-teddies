import React from 'react';
import { motion } from 'framer-motion';
import { Button } from "@/components/ui/button";

const BattleRewards = ({ winner, onClose }) => {
  const rewards = winner === 'player' ? {
    experience: 100,
    coins: 50,
    items: ['Rare Card Pack', 'Energy Potion']
  } : {
    experience: 25,
    coins: 10,
    items: ['Common Card Pack']
  };

  return (
    <motion.div
      className="battle-rewards fixed inset-0 flex items-center justify-center bg-black bg-opacity-50"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <motion.div
        className="bg-white p-6 rounded-lg shadow-lg"
        initial={{ scale: 0.9, y: 50 }}
        animate={{ scale: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      >
        <h2 className="text-2xl font-bold mb-4">Battle Rewards</h2>
        <p className="mb-2">Experience: {rewards.experience} XP</p>
        <p className="mb-2">Coins: {rewards.coins}</p>
        <h3 className="font-semibold mt-4 mb-2">Items:</h3>
        <ul className="list-disc list-inside mb-4">
          {rewards.items.map((item, index) => (
            <li key={index}>{item}</li>
          ))}
        </ul>
        <Button onClick={onClose}>Close</Button>
      </motion.div>
    </motion.div>
  );
};

export default BattleRewards;