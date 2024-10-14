import React from 'react';
import { motion } from 'framer-motion';

const BattleAnimation = ({ action, attacker }) => {
  const animations = {
    attack: {
      initial: { scale: 1, x: 0 },
      animate: { scale: [1, 1.2, 1], x: [0, 50, 0] },
      transition: { duration: 0.5 },
    },
    defend: {
      initial: { opacity: 0, scale: 0 },
      animate: { opacity: [0, 1, 0], scale: [0, 1.5, 0] },
      transition: { duration: 0.5 },
    },
    special: {
      initial: { opacity: 0, scale: 0, rotate: 0 },
      animate: { opacity: [0, 1, 0], scale: [0, 2, 0], rotate: [0, 360, 0] },
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