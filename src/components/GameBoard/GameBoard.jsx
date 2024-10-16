import React, { useState } from 'react';
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import TeddyCard from '../TeddyCard';

const GameBoard = () => {
  const [playerHand, setPlayerHand] = useState([
    { id: 1, name: "Teddy 1", attack: 2, defense: 2 },
    { id: 2, name: "Teddy 2", attack: 3, defense: 1 },
    { id: 3, name: "Teddy 3", attack: 1, defense: 3 },
    { id: 4, name: "Teddy 4", attack: 2, defense: 2 },
    { id: 5, name: "Teddy 5", attack: 3, defense: 2 },
  ]);
  const [playerField, setPlayerField] = useState([]);
  const [opponentField, setOpponentField] = useState([
    { id: 6, name: "Opponent 1", attack: 2, defense: 2 },
    { id: 7, name: "Opponent 2", attack: 2, defense: 2 },
  ]);
  const [currentTurn, setCurrentTurn] = useState('player');
  const [playerHealth, setPlayerHealth] = useState(30);
  const [opponentHealth, setOpponentHealth] = useState(30);

  const playCard = (card) => {
    if (currentTurn === 'player' && playerField.length < 3) {
      setPlayerField([...playerField, card]);
      setPlayerHand(playerHand.filter(c => c.id !== card.id));
    }
  };

  const attack = (attackingCard, targetCard) => {
    if (currentTurn === 'player') {
      const damage = Math.max(0, attackingCard.attack - targetCard.defense);
      setOpponentHealth(prevHealth => Math.max(0, prevHealth - damage));
      setOpponentField(opponentField.filter(c => c.id !== targetCard.id));
    }
  };

  const endTurn = () => {
    setCurrentTurn(currentTurn === 'player' ? 'opponent' : 'player');
    // Implement opponent's turn logic here
  };

  return (
    <div className="relative w-full h-screen bg-amber-100 overflow-hidden">
      {/* Top decorative border */}
      <div className="absolute top-0 left-0 right-0 h-16 bg-gradient-to-r from-brown-800 to-brown-600 flex items-center justify-between px-4">
        <div className="text-white font-bold">Opponent</div>
        <div className="flex items-center space-x-2">
          <div className="w-8 h-8 bg-blue-500 rounded-full"></div>
          <div className="text-white">{opponentHealth}</div>
        </div>
      </div>

      {/* Opponent's field */}
      <div className="absolute top-20 left-1/2 transform -translate-x-1/2 flex justify-center space-x-2">
        {opponentField.map((card) => (
          <TeddyCard key={card.id} teddy={card} />
        ))}
      </div>

      {/* Main game board */}
      <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-4/5 h-2/3 bg-amber-200 rounded-lg border-4 border-brown-600 flex flex-col justify-between p-4">
        {/* Player's field */}
        <div className="flex justify-center space-x-2 mt-auto">
          {playerField.map((card) => (
            <TeddyCard 
              key={card.id} 
              teddy={card} 
              onClick={() => currentTurn === 'player' && opponentField.length > 0 && attack(card, opponentField[0])}
            />
          ))}
        </div>
      </div>

      {/* Player's hand */}
      <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex justify-center space-x-2">
        {playerHand.map((card) => (
          <TeddyCard 
            key={card.id} 
            teddy={card} 
            onClick={() => currentTurn === 'player' && playCard(card)}
          />
        ))}
      </div>

      {/* Bottom decorative border */}
      <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-r from-brown-800 to-brown-600 flex items-center justify-between px-4">
        <div className="text-white font-bold">Player</div>
        <div className="flex items-center space-x-2">
          <div className="w-8 h-8 bg-green-500 rounded-full"></div>
          <div className="text-white">{playerHealth}</div>
        </div>
      </div>

      {/* End Turn button */}
      <Button 
        className="absolute bottom-20 right-4 bg-green-500 hover:bg-green-600 text-white"
        onClick={endTurn}
        disabled={currentTurn !== 'player'}
      >
        End Turn
      </Button>
    </div>
  );
};

export default GameBoard;