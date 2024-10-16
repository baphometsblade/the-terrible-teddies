import React from 'react';
import { motion } from 'framer-motion';

interface TurnIndicatorProps {
  currentTurn: 'player' | 'opponent';
}

const TurnIndicator: React.FC<TurnIndicatorProps> = ({ currentTurn }) => {
  return (
    <motion.div
      className={`turn-indicator p-2 rounded-full text-white font-bold ${
        currentTurn === 'player' ? 'bg-blue-500' : 'bg-red-500'
      }`}
      initial={{ scale: 0 }}
      animate={{ scale: 1 }}
      transition={{ type: 'spring', stiffness: 260, damping: 20 }}
    >
      {currentTurn === 'player' ? 'Your Turn' : 'Opponent\'s Turn'}
    </motion.div>
  );
};

export default TurnIndicator;