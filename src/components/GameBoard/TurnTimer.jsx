import React from 'react';
import { motion } from 'framer-motion';
import { Progress } from '@/components/ui/progress';

export const TurnTimer = ({ timeLeft, currentTurn }) => {
  const isPlayerTurn = currentTurn === 'player';
  const progress = (timeLeft / 30) * 100;

  return (
    <div className="mt-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        className="flex items-center justify-center"
      >
        <Progress 
          value={progress} 
          className={`w-64 h-2 ${isPlayerTurn ? 'bg-blue-200' : 'bg-red-200'}`} 
        />
        <span className={`ml-2 font-bold ${isPlayerTurn ? 'text-blue-600' : 'text-red-600'}`}>
          {timeLeft}s
        </span>
      </motion.div>
    </div>
  );
};