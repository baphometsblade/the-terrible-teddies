import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { terribleTeddies } from '../data/terribleTeddies';

const GameBoard = () => {
  const [playerHand, setPlayerHand] = useState(terribleTeddies.slice(0, 5));
  const [opponentHand, setOpponentHand] = useState(terribleTeddies.slice(5, 10));
  const [currentTurn, setCurrentTurn] = useState('player');

  const playCard = (card) => {
    // Implement card playing logic here
    console.log(`Playing card: ${card.name}`);
    setCurrentTurn(currentTurn === 'player' ? 'opponent' : 'player');
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <h2 className="text-2xl font-bold mb-4">Game Board</h2>
      <div className="mb-4">
        <p>Current Turn: {currentTurn}</p>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <h3 className="text-xl font-bold mb-2">Your Hand</h3>
          {playerHand.map((card) => (
            <div key={card.id} className="mb-2 p-2 border rounded">
              <p>{card.name}</p>
              <p>Attack: {card.attack} | Defense: {card.defense}</p>
              <Button onClick={() => playCard(card)} disabled={currentTurn !== 'player'}>
                Play Card
              </Button>
            </div>
          ))}
        </div>
        <div>
          <h3 className="text-xl font-bold mb-2">Opponent's Hand</h3>
          {opponentHand.map((card) => (
            <div key={card.id} className="mb-2 p-2 border rounded">
              <p>{card.name}</p>
              <p>Attack: {card.attack} | Defense: {card.defense}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default GameBoard;