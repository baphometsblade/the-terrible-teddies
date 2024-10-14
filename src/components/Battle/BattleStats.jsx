import React from 'react';
import { motion } from 'framer-motion';

const BattleStats = ({ battleState }) => {
  const stats = [
    { label: 'Rounds', value: battleState.roundCount },
    { label: 'Player Level', value: battleState.playerLevel },
    { label: 'Player XP', value: `${battleState.playerExperience}/${battleState.playerLevel * 100}` },
    { label: 'Combos Used', value: battleState.combosUsed || 0 },
    { label: 'Power-Ups Activated', value: battleState.powerUpsActivated || 0 },
  ];

  return (
    <motion.div
      className="battle-stats mt-4 p-4 bg-gray-200 rounded-lg"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <h3 className="text-lg font-semibold mb-2">Battle Statistics</h3>
      <div className="grid grid-cols-2 gap-2">
        {stats.map((stat, index) => (
          <div key={index} className="flex justify-between">
            <span className="font-medium">{stat.label}:</span>
            <span>{stat.value}</span>
          </div>
        ))}
      </div>
    </motion.div>
  );
};

export default BattleStats;