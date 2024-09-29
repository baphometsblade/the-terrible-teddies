import React from 'react';
import TeddyCard from './TeddyCard';

const PlayerHand = ({ hand, onSelectTeddy, selectedTeddy }) => {
  return (
    <div className="flex flex-wrap justify-center gap-4">
      {hand.map(teddy => (
        <TeddyCard
          key={teddy.id}
          teddy={teddy}
          onSelect={onSelectTeddy}
          isSelected={selectedTeddy && selectedTeddy.id === teddy.id}
        />
      ))}
    </div>
  );
};

export default PlayerHand;