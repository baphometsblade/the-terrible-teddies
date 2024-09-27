import React from 'react';

const OpponentArea = ({ hp, hand }) => {
  return (
    <div className="opponent-area">
      <h3>Opponent</h3>
      <div>HP: {hp}</div>
      <div>Cards in hand: {hand.length}</div>
    </div>
  );
};

export default OpponentArea;