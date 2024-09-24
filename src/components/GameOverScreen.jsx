import React from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Trophy, Home } from 'lucide-react';

export const GameOverScreen = ({ winner, playerScore, opponentScore, onPlayAgain, onMainMenu }) => {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5 }}
      className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-70 z-50"
    >
      <div className="bg-white rounded-lg shadow-xl p-8 max-w-md w-full text-center">
        <Trophy className="w-24 h-24 mx-auto text-yellow-500 mb-4" />
        <h2 className="text-4xl font-bold text-purple-800 mb-4">
          {winner === 'player' ? 'You Win!' : 'Game Over'}
        </h2>
        <p className="text-xl text-gray-700 mb-6">
          {winner === 'player' ? 'Congratulations!' : 'Better luck next time!'}
        </p>
        <div className="flex justify-between mb-8">
          <div>
            <p className="text-lg font-semibold text-purple-600">Your Score</p>
            <p className="text-3xl font-bold text-purple-800">{playerScore}</p>
          </div>
          <div>
            <p className="text-lg font-semibold text-purple-600">Opponent's Score</p>
            <p className="text-3xl font-bold text-purple-800">{opponentScore}</p>
          </div>
        </div>
        <div className="space-y-4">
          <Button onClick={onPlayAgain} className="w-full bg-green-500 hover:bg-green-600 text-white text-lg py-3">
            Play Again
          </Button>
          <Button onClick={onMainMenu} className="w-full bg-purple-500 hover:bg-purple-600 text-white text-lg py-3">
            <Home className="w-5 h-5 mr-2" />
            Main Menu
          </Button>
        </div>
      </div>
    </motion.div>
  );
};
