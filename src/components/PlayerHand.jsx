import React from 'react';
import TeddyCard from './TeddyCard';

const PlayerHand = ({ hand, onCardSelect }) => {
  return (
    <div className="mt-8">
      <h2 className="text-2xl font-bold mb-4">Your Hand</h2>
      <div className="flex flex-wrap gap-4">
        {hand.map((teddy) => (
          <TeddyCard key={teddy.id} teddy={teddy} onSelect={onCardSelect} />
        ))}
      </div>
    </div>
  );
};

export default PlayerHand;