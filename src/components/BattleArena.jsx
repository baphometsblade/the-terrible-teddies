import React from 'react';
import TeddyCard from './TeddyCard';

const BattleArena = ({ currentPlayer, selectedCard }) => {
  return (
    <div className="battle-arena bg-green-100 p-4 rounded-lg shadow-md mb-4">
      <h2 className="text-2xl font-bold mb-2">Battle Arena</h2>
      <p>Current Turn: {currentPlayer}</p>
      {selectedCard && (
        <div className="selected-card mt-4">
          <h3 className="text-xl font-bold mb-2">Selected Card</h3>
          <TeddyCard teddy={selectedCard} isPlayable={false} />
        </div>
      )}
    </div>
  );
};

export default BattleArena;