import React from 'react';

const BattleArena = ({ currentTurn }) => {
  return (
    <div className="battle-arena bg-green-100 p-4 rounded-lg shadow-md mb-4">
      <h2 className="text-2xl font-bold mb-2">Battle Arena</h2>
      <p>Current Turn: {currentTurn}</p>
    </div>
  );
};

export default BattleArena;