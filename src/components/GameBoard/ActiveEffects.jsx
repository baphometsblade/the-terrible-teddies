import React from 'react';
import { motion } from 'framer-motion';
import { Shield, Zap } from 'lucide-react';

export const ActiveEffects = ({ effects, player }) => {
  const getEffectIcon = (type) => {
    switch (type) {
      case 'Boost':
        return <Zap className="w-4 h-4 text-yellow-500" />;
      case 'Trap':
        return <Shield className="w-4 h-4 text-red-500" />;
      default:
        return null;
    }
  };

  return (
    <div className={`active-effects ${player === 'player' ? 'mt-2' : 'mb-2'}`}>
      <div className="flex space-x-2">
        {effects.map((effect, index) => (
          <motion.div
            key={index}
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            exit={{ scale: 0 }}
            className="bg-gray-200 rounded-full p-1"
            title={`${effect.type}: ${effect.effect.description}`}
          >
            {getEffectIcon(effect.type)}
          </motion.div>
        ))}
      </div>
    </div>
  );
};