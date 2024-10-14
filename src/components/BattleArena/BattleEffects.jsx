import React from 'react';
import { motion } from 'framer-motion';

const BattleEffects = ({ effect }) => {
  if (!effect) return null;

  return (
    <motion.div
      className="battle-effects bg-purple-100 p-4 rounded-lg shadow-md"
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      transition={{ duration: 0.3 }}
    >
      <h3 className="text-xl font-bold mb-2">{effect.name}</h3>
      <p className="text-gray-700">{effect.description}</p>
      <div className="mt-2 text-sm text-gray-600">
        Duration: {effect.duration} turns
      </div>
    </motion.div>
  );
};

export default BattleEffects;