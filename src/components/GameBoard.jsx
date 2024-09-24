import React, { useState } from 'react';
import { TeddyCard } from './TeddyCard';
import { Button } from "@/components/ui/button";

const initialTeddies = [
  { id: 1, name: "Blitzkrieg Bear", attack: 9, defense: 7, specialMove: "Total Annihilation" },
  { id: 2, name: "Icy Ivan", attack: 7, defense: 8, specialMove: "Ice Age" },
  { id: 3, name: "Lady Lush", attack: 6, defense: 6, specialMove: "Drunken Master" },
  { id: 4, name: "Chainsaw Charlie", attack: 10, defense: 5, specialMove: "Timber!" },
];

export const GameBoard = () => {
  const [playerTeddies, setPlayerTeddies] = useState(initialTeddies.slice(0, 2));
  const [opponentTeddies, setOpponentTeddies] = useState(initialTeddies.slice(2, 4));
  const [currentTurn, setCurrentTurn] = useState('player');

  const handleEndTurn = () => {
    setCurrentTurn(currentTurn === 'player' ? 'opponent' : 'player');
  };

  return (
    <div className="game-board">
      <div className="opponent-area mb-8">
        <h2 className="text-2xl font-bold mb-4">Opponent's Teddies</h2>
        <div className="flex space-x-4">
          {opponentTeddies.map(teddy => (
            <TeddyCard key={teddy.id} teddy={teddy} />
          ))}
        </div>
      </div>
      <div className="battle-area mb-8 bg-gray-800 h-64 flex items-center justify-center">
        <p className="text-2xl">{currentTurn === 'player' ? "Your Turn" : "Opponent's Turn"}</p>
      </div>
      <div className="player-area">
        <h2 className="text-2xl font-bold mb-4">Your Teddies</h2>
        <div className="flex space-x-4 mb-4">
          {playerTeddies.map(teddy => (
            <TeddyCard key={teddy.id} teddy={teddy} />
          ))}
        </div>
        <Button onClick={handleEndTurn} className="bg-blue-600 hover:bg-blue-700">
          End Turn
        </Button>
      </div>
    </div>
  );
};
