import React from 'react';
import TeddyCard from '../TeddyCard';

const PlayerArea = ({ selectedTeddy, playerHealth, playerEnergy }) => {
  return (
    <div>
      <h2 className="text-2xl font-bold mb-2">Your Teddy</h2>
      {selectedTeddy && (
        <TeddyCard teddy={selectedTeddy} />
      )}
      <p>Health: {playerHealth}</p>
      <p>Energy: {playerEnergy}</p>
    </div>
  );
};

export default PlayerArea;