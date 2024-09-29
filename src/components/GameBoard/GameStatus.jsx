import React from 'react';

const GameStatus = ({ gameState }) => {
  return (
    <div className="mt-4">
      <h2 className="text-2xl font-bold mb-2">Game Status</h2>
      <p>Current State: {gameState}</p>
    </div>
  );
};

export default GameStatus;