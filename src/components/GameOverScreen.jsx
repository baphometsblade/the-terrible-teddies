import React from 'react';
import { Button } from "@/components/ui/button";

const GameOverScreen = ({ winner, onPlayAgain }) => {
  return (
    <div className="game-over-screen bg-gray-800 text-white p-8 rounded-lg shadow-lg text-center">
      <h2 className="text-4xl font-bold mb-4">Game Over</h2>
      <p className="text-2xl mb-6">{winner === 'player' ? 'You Win!' : 'You Lose!'}</p>
      <Button onClick={onPlayAgain} className="bg-green-500 hover:bg-green-600">
        Play Again
      </Button>
    </div>
  );
};

export default GameOverScreen;