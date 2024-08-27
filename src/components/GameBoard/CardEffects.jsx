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

export const CardEffects = ({ effect, type }) => {
  const Icon = effectIcons[type] || Zap;

  return (
    <motion.div
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 0, opacity: 0 }}
      className="absolute inset-0 flex items-center justify-center"
    >
      <div className="bg-white bg-opacity-80 rounded-full p-4">
        <Icon className="w-12 h-12 text-purple-600" />
      </div>
      <p className="absolute bottom-4 left-0 right-0 text-center text-lg font-bold text-white shadow-text">
        {effect}
      </p>
    </motion.div>
  );
};