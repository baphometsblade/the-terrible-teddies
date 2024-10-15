import React from 'react';
import { motion } from 'framer-motion';

const BattleAnimation = ({ action, attacker }) => {
  const animations = {
    attack: { x: [0, 50, 0], transition: { duration: 0.5 } },
    defend: { scale: [1, 1.2, 1], transition: { duration: 0.5 } },
    special: { rotate: [0, 360], scale: [1, 1.5, 1], transition: { duration: 0.8 } },
  };

  return (
    <motion.div
      className="absolute inset-0 flex items-center justify-center pointer-events-none"
      animate={animations[action]}
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