import React from 'react';
import GameBoard from './GameBoard';

const Game = () => {
  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-4xl font-bold mb-8 text-center text-purple-600">Terrible Teddies</h1>
      <GameBoard />
    </div>
  );
};

export default Game;