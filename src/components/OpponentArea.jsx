import React from 'react';

export const OpponentArea = ({ opponent }) => {
  return (
    <div className="opponent-area">
      <h2>Opponent</h2>
      <p>HP: {opponent.hp}</p>
      <p>Cards in hand: {opponent.hand.length}</p>
    </div>
  );
};
