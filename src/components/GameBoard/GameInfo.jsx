import React from 'react';
import { motion } from 'framer-motion';
import { Progress } from '@/components/ui/progress';
import { Zap } from 'lucide-react';

export const GameInfo = ({ currentTurn, momentumGauge }) => {
  return (
    <div className="game-info mb-6 bg-gradient-to-r from-blue-100 to-purple-100 p-4 rounded-lg shadow-md">
      <div className="flex justify-between items-center mb-2">
        <p className="text-xl font-semibold text-purple-800">Current Turn:</p>
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", stiffness: 260, damping: 20 }}
          className={`px-4 py-2 rounded-full ${
            currentTurn === 'player' ? 'bg-green-500 text-white' : 'bg-red-500 text-white'
          }`}
        >
          {currentTurn === 'player' ? 'Your Turn' : 'Opponent\'s Turn'}
        </motion.div>
      </div>
      <div className="flex items-center">
        <Zap className="w-6 h-6 text-yellow-500 mr-2" />
        <Progress value={(momentumGauge / 10) * 100} className="w-full h-4 bg-blue-200" />
        <p className="text-sm ml-2 text-purple-700 font-semibold">{momentumGauge}/10</p>
      </div>
    </div>
  );
};
