import React from 'react';
import { motion } from 'framer-motion';

const CrowdReaction = ({ mood }) => {
  const moodEmojis = {
    excited: '🎉',
    neutral: '😐',
    worried: '😟',
  };

  const moodColors = {
    excited: 'bg-green-200',
    neutral: 'bg-gray-200',
    worried: 'bg-red-200',
  };

  return (
    <motion.div
      className={`crowd-reaction mt-4 p-4 rounded-lg ${moodColors[mood]}`}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <h3 className="text-lg font-semibold mb-2">Crowd Reaction</h3>
      <div className="text-4xl text-center">
        {moodEmojis[mood]}
      </div>
      <p className="text-center mt-2">
        {mood === 'excited' && "The crowd is going wild!"}
        {mood === 'neutral' && "The crowd watches intently."}
        {mood === 'worried' && "The crowd is on the edge of their seats!"}
      </p>
    </motion.div>
  );
};

export default CrowdReaction;