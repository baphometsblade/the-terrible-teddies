import React from 'react';
import { motion } from 'framer-motion';

export const TurnIndicator = ({ currentTurn, darkMode }) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className={`text-center py-2 px-4 rounded-full ${
        darkMode ? 'bg-gray-700 text-white' : 'bg-white text-purple-800'
      } shadow-md mb-4`}
    >
      <span className="font-bold">
        {currentTurn === 'player' ? "Your Turn" : "Opponent's Turn"}
      </span>
    </motion.div>
  );
};