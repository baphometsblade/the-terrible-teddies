import React, { useState } from 'react';
import TeddyCard from '../TeddyCard';
import { Button } from "@/components/ui/button";

const BattleArena = () => {
  const [playerHealth, setPlayerHealth] = useState(30);
  const [opponentHealth, setOpponentHealth] = useState(30);
  const [currentTurn, setCurrentTurn] = useState('player');

  const dummyTeddy = {
    name: "Whiskey Whiskers",
    title: "The Smooth Operator",
    description: "A suave bear with a penchant for fine spirits and even finer company.",
    attack: 6,
    defense: 5,
    special_move: "On the Rocks"
  };

  const handleAttack = () => {
    if (currentTurn === 'player') {
      setOpponentHealth(prev => Math.max(0, prev - 5));
      setCurrentTurn('opponent');
    } else {
      setPlayerHealth(prev => Math.max(0, prev - 5));
      setCurrentTurn('player');
    }
  };

  return (
    <div className="battle-arena p-4">
      <h2 className="text-2xl font-bold mb-4">Battle Arena</h2>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <h3 className="text-xl mb-2">Player</h3>
          <TeddyCard teddy={dummyTeddy} />
          <p>Health: {playerHealth}</p>
        </div>
        <div>
          <h3 className="text-xl mb-2">Opponent</h3>
          <TeddyCard teddy={dummyTeddy} />
          <p>Health: {opponentHealth}</p>
        </div>
      </div>
      <Button onClick={handleAttack} className="mt-4">
        {currentTurn === 'player' ? 'Attack Opponent' : 'Opponent Attacks'}
      </Button>
    </div>
  );
};

export default BattleArena;