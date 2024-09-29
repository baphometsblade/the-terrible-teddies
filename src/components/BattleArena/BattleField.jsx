import React from 'react';
import TeddyCard from '../TeddyCard';

const BattleField = ({ battle }) => {
  return (
    <div className="grid grid-cols-2 gap-4 mb-4">
      <div>
        <h2 className="text-xl font-bold mb-2">Player 1</h2>
        {battle.player1_teddy && <TeddyCard teddy={battle.player1_teddy} />}
        <p>Health: {battle.player1_health}/30</p>
      </div>
      <div>
        <h2 className="text-xl font-bold mb-2">{battle.is_ai_opponent ? 'AI Opponent' : 'Player 2'}</h2>
        {battle.player2_teddy && <TeddyCard teddy={battle.player2_teddy} />}
        <p>Health: {battle.player2_health}/30</p>
      </div>
    </div>
  );
};

export default BattleField;