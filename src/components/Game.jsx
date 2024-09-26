import React, { useState } from 'react';
import { Button } from "@/components/ui/button";

const Game = () => {
  const [playerHealth, setPlayerHealth] = useState(30);
  const [opponentHealth, setOpponentHealth] = useState(30);

  const attack = () => {
    const damage = Math.floor(Math.random() * 5) + 1;
    setOpponentHealth(prev => Math.max(0, prev - damage));
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <h2 className="text-2xl font-bold mb-4">Terrible Teddies Battle</h2>
      <div className="flex justify-between mb-4">
        <div>
          <p>Your Health: {playerHealth}</p>
        </div>
        <div>
          <p>Opponent Health: {opponentHealth}</p>
        </div>
      </div>
      <Button onClick={attack} className="bg-red-500 hover:bg-red-600 text-white font-bold py-2 px-4 rounded">
        Attack
      </Button>
      {opponentHealth <= 0 && <p className="mt-4 text-green-600 font-bold">You win!</p>}
    </div>
  );
};

export default Game;