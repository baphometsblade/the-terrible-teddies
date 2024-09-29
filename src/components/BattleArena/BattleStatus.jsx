import React from 'react';

const BattleStatus = ({ battle }) => {
  const isPlayer1Turn = battle.current_turn === battle.player1_id;

  return (
    <div>
      <h3 className="text-lg font-bold mb-2">Battle Status</h3>
      <p>Current Turn: {isPlayer1Turn ? 'Player 1' : (battle.is_ai_opponent ? 'AI Opponent' : 'Player 2')}</p>
      <p>Status: {battle.status}</p>
    </div>
  );
};

export default BattleStatus;