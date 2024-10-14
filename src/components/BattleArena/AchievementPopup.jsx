import React from 'react';
import { motion } from 'framer-motion';

const AchievementPopup = ({ achievement }) => {
  return (
    <motion.div
      className="achievement-popup fixed top-4 right-4 bg-yellow-100 p-4 rounded-lg shadow-lg"
      initial={{ y: -50, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: -50, opacity: 0 }}
      transition={{ duration: 0.5 }}
    >
      <h3 className="text-xl font-bold mb-2">Achievement Unlocked!</h3>
      <p>{achievement.name}</p>
      <p className="text-sm text-gray-600">{achievement.description}</p>
    </motion.div>
  );
};

export default AchievementPopup;