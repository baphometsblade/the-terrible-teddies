import React from 'react';

export const GameBoard = ({ currentTurn }) => {
  return (
    <div className="bg-green-100 p-4 rounded-lg shadow-md mb-4">
      <h2 className="text-2xl font-bold mb-2">Game Board</h2>
      <p>Current Turn: {currentTurn}</p>
    </div>
  );
};