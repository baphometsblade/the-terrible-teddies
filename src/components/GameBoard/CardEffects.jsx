import React from 'react';
import { motion } from 'framer-motion';
import { Zap, Shield, Heart, Sword, AlertTriangle } from 'lucide-react';

const effectIcons = {
  ACTION: Sword,
  TRAP: AlertTriangle,
  SPECIAL: Heart,
  DEFENSE: Shield,
  BOOST: Zap,
};

const effectAnimations = {
  ACTION: {
    initial: { rotate: -45, scale: 0 },
    animate: { rotate: 0, scale: 1 },
    transition: { type: 'spring', stiffness: 200, damping: 10 }
  },
  TRAP: {
    initial: { y: -50, opacity: 0 },
    animate: { y: 0, opacity: 1 },
    transition: { type: 'spring', stiffness: 300, damping: 15 }
  },
  SPECIAL: {
    initial: { scale: 2, opacity: 0 },
    animate: { scale: 1, opacity: 1 },
    transition: { type: 'spring', stiffness: 250, damping: 12 }
  },
  DEFENSE: {
    initial: { scale: 0, rotate: 180 },
    animate: { scale: 1, rotate: 0 },
    transition: { type: 'spring', stiffness: 200, damping: 10 }
  },
  BOOST: {
    initial: { y: 50, opacity: 0 },
    animate: { y: 0, opacity: 1 },
    transition: { type: 'spring', stiffness: 300, damping: 15 }
  },
};

export const CardEffects = ({ effect, type }) => {
  const Icon = effectIcons[type] || Zap;
  const animation = effectAnimations[type] || effectAnimations.ACTION;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="absolute inset-0 flex items-center justify-center"
    >
      <motion.div
        className="bg-white bg-opacity-80 rounded-full p-4"
        {...animation}
      >
        <Icon className="w-12 h-12 text-purple-600" />
      </motion.div>
      <motion.p
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="absolute bottom-4 left-0 right-0 text-center text-lg font-bold text-white shadow-text"
      >
        {effect}
      </motion.p>
    </motion.div>
  );
};
