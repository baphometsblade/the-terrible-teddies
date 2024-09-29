import React from 'react';
import TeddyCard from '../TeddyCard';

const OpponentArea = ({ opponentTeddy, opponentHealth, opponentEnergy }) => {
  return (
    <div>
      <h2 className="text-2xl font-bold mb-2">Opponent's Teddy</h2>
      {opponentTeddy && (
        <TeddyCard teddy={opponentTeddy} />
      )}
      <p>Health: {opponentHealth}</p>
      <p>Energy: {opponentEnergy}</p>
    </div>
  );
};

export default OpponentArea;