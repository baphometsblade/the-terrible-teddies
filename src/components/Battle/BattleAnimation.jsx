import React from 'react';
import { motion } from 'framer-motion';

const BattleAnimation = ({ action, attacker }) => {
  const animations = {
    attack: {
      initial: { x: 0, opacity: 1 },
      animate: { x: [0, 100, 0], opacity: [1, 0.5, 1] },
      transition: { duration: 0.5 },
    },
    defend: {
      initial: { scale: 1 },
      animate: { scale: [1, 1.2, 1] },
      transition: { duration: 0.5 },
    },
    special: {
      initial: { rotate: 0, scale: 1 },
      animate: { rotate: 360, scale: [1, 1.5, 1] },
      transition: { duration: 0.8 },
    },
  };

  return (
    <motion.div
      className="absolute inset-0 flex items-center justify-center pointer-events-none"
      {...animations[action]}
    >
      <div className="text-4xl font-bold">
        {action === 'attack' && '💥'}
        {action === 'defend' && '🛡️'}
        {action === 'special' && '✨'}
      </div>
    </motion.div>
  );
};

export default BattleAnimation;