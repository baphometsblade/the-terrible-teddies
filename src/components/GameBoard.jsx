import React from 'react';
import TeddyCard from './TeddyCard';

const GameBoard = ({ generatedTeddies }) => {
  return (
    <div className="game-board">
      <h2 className="text-2xl font-bold mb-4">Game Board</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {generatedTeddies.map((teddy) => (
          <TeddyCard key={teddy.id} teddy={teddy} />
        ))}
      </div>
    </div>
  );
};

export default GameBoard;