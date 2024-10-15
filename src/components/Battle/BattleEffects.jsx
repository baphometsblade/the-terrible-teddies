import React from 'react';
import { motion } from 'framer-motion';

const BattleEffects = ({ effect }) => {
  if (!effect) return null;

  const particleVariants = {
    initial: { opacity: 0, scale: 0 },
    animate: { opacity: [0, 1, 0], scale: [0, 1, 0] },
  };

  return (
    <motion.div
      className="battle-effects absolute inset-0 pointer-events-none"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      {[...Array(20)].map((_, i) => (
        <motion.div
          key={i}
          className="absolute w-4 h-4 bg-yellow-400 rounded-full"
          variants={particleVariants}
          initial="initial"
          animate="animate"
          transition={{
            duration: 1,
            repeat: Infinity,
            delay: Math.random() * 2,
          }}
          style={{
            left: `${Math.random() * 100}%`,
            top: `${Math.random() * 100}%`,
          }}
        />
      ))}
      <motion.div
        className="absolute inset-0 bg-gradient-to-r from-transparent via-yellow-200 to-transparent"
        initial={{ opacity: 0 }}
        animate={{ opacity: [0, 0.2, 0] }}
        transition={{ duration: 2, repeat: Infinity }}
      />
    </motion.div>
  );
};

export default BattleEffects;