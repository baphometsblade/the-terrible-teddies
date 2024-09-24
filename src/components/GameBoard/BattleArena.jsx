import React from 'react';
import TeddyCard from '../TeddyCard';

export const BattleArena = ({ playerTeddies, opponentTeddies, selectedTeddy, onTeddySelect, onAttack, currentTurn }) => {
  return (
    <div className="battle-arena flex justify-between my-8">
      <div className="player-teddies flex flex-wrap justify-center gap-4">
        {playerTeddies.map((teddy) => (
          <TeddyCard
            key={teddy.id}
            teddy={teddy}
            onClick={() => onTeddySelect(teddy)}
            isSelected={selectedTeddy && selectedTeddy.id === teddy.id}
          />
        ))}
      </div>
      <div className="opponent-teddies flex flex-wrap justify-center gap-4">
        {opponentTeddies.map((teddy) => (
          <TeddyCard
            key={teddy.id}
            teddy={teddy}
            onClick={() => currentTurn === 'player' && selectedTeddy && onAttack(teddy)}
          />
        ))}
      </div>
    </div>
  );
};
