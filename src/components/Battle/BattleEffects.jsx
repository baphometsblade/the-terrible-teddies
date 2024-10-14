import React from 'react';
import { motion } from 'framer-motion';

const BattleEffects = () => {
  return (
    <motion.div
      className="battle-effects absolute inset-0 pointer-events-none"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
    >
      <motion.div
        className="effect-particle bg-red-500 rounded-full w-4 h-4"
        initial={{ scale: 0, x: '50%', y: '50%' }}
        animate={{
          scale: [0, 1.5, 0],
          x: ['50%', '30%', '70%', '50%'],
          y: ['50%', '70%', '30%', '50%'],
        }}
        transition={{ duration: 0.5, times: [0, 0.2, 1], repeat: 2 }}
      />
      <motion.div
        className="effect-particle bg-yellow-500 rounded-full w-3 h-3"
        initial={{ scale: 0, x: '50%', y: '50%' }}
        animate={{
          scale: [0, 1.2, 0],
          x: ['50%', '70%', '30%', '50%'],
          y: ['50%', '30%', '70%', '50%'],
        }}
        transition={{ duration: 0.5, times: [0, 0.2, 1], repeat: 2, delay: 0.1 }}
      />
      <motion.div
        className="effect-particle bg-blue-500 rounded-full w-2 h-2"
        initial={{ scale: 0, x: '50%', y: '50%' }}
        animate={{
          scale: [0, 1, 0],
          x: ['50%', '30%', '70%', '50%'],
          y: ['50%', '70%', '30%', '50%'],
        }}
        transition={{ duration: 0.5, times: [0, 0.2, 1], repeat: 2, delay: 0.2 }}
      />
    </motion.div>
  );
};

export default BattleEffects;