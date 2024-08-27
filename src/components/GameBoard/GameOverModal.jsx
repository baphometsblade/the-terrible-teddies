import React from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import confetti from 'canvas-confetti';

export const GameOverModal = ({ winner, onPlayAgain, onExit }) => {
  React.useEffect(() => {
    if (winner === 'player') {
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 }
      });
    }
  }, [winner]);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.8 }}
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
    >
      <div className="bg-white p-8 rounded-lg shadow-xl text-center">
        <h2 className="text-3xl font-bold mb-4 text-purple-800">
          {winner === 'player' ? 'You Win!' : 'You Lose!'}
        </h2>
        <p className="mb-6 text-lg text-gray-700">
          {winner === 'player' 
            ? 'Congratulations! Your terrible teddies reign supreme!' 
            : 'Oh no! Your teddies have been out-naughtied!'}
        </p>
        <div className="space-x-4">
          <Button onClick={onPlayAgain} className="bg-green-500 hover:bg-green-600 text-white">
            Play Again
          </Button>
          <Button onClick={onExit} variant="outline" className="border-red-500 text-red-500 hover:bg-red-50">
            Exit to Menu
          </Button>
        </div>
      </div>
    </motion.div>
  );
};