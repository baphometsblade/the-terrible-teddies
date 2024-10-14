import React from 'react';
import { motion } from 'framer-motion';

const BattleArenaBackground = ({ weatherEffect }) => {
  const getBackgroundStyle = () => {
    switch (weatherEffect.name) {
      case 'Sunny':
        return 'bg-gradient-to-b from-yellow-200 to-blue-300';
      case 'Rainy':
        return 'bg-gradient-to-b from-gray-400 to-blue-500';
      case 'Windy':
        return 'bg-gradient-to-br from-green-200 to-blue-300';
      case 'Stormy':
        return 'bg-gradient-to-b from-gray-700 to-purple-900';
      default:
        return 'bg-gradient-to-b from-blue-200 to-blue-400';
    }
  };

  return (
    <motion.div
      className={`absolute inset-0 ${getBackgroundStyle()}`}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 1 }}
    >
      {weatherEffect.name === 'Rainy' && (
        <motion.div
          className="absolute inset-0 bg-blue-500 opacity-30"
          initial={{ y: '-100%' }}
          animate={{ y: '100%' }}
          transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
        />
      )}
      {weatherEffect.name === 'Windy' && (
        <motion.div
          className="absolute inset-0 bg-white opacity-10"
          initial={{ x: '-100%' }}
          animate={{ x: '100%' }}
          transition={{ repeat: Infinity, duration: 3, ease: 'linear' }}
        />
      )}
    </motion.div>
  );
};

export default BattleArenaBackground;