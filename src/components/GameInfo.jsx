import React from 'react';

export const GameInfo = ({ currentPlayer, turn }) => {
  return (
    <div className="game-info">
      <h2>Game Info</h2>
      <p>Current Player: {currentPlayer}</p>
      <p>Turn: {turn}</p>
    </div>
  );
};