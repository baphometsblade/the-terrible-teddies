import React from 'react';

export const OpponentArea = ({ health, hand }) => {
  return (
    <div className="bg-red-100 p-4 rounded-lg shadow-md mb-4">
      <h2 className="text-2xl font-bold mb-2">Opponent</h2>
      <p>Health: {health}</p>
      <p>Cards in hand: {hand.length}</p>
    </div>
  );
};