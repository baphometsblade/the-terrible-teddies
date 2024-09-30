import React, { useState } from 'react';
import { Button } from "@/components/ui/button";

const Battle = () => {
  const [playerHealth, setPlayerHealth] = useState(30);
  const [opponentHealth, setOpponentHealth] = useState(30);
  const [currentTurn, setCurrentTurn] = useState('player');

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
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-6">Battle Arena</h1>
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <h2 className="text-xl font-bold">Player</h2>
          <p>Health: {playerHealth}</p>
        </div>
        <div>
          <h2 className="text-xl font-bold">Opponent</h2>
          <p>Health: {opponentHealth}</p>
        </div>
      </div>
      <Button onClick={handleAttack} disabled={currentTurn !== 'player'}>
        Attack
      </Button>
    </div>
  );
};

export default Battle;