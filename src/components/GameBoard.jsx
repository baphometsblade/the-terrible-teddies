import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import TeddyCard from './TeddyCard';

const initialTeddies = [
  { id: 1, name: "Blitzkrieg Bear", attack: 9, defense: 7, specialMove: "Total Annihilation" },
  { id: 2, name: "Icy Ivan", attack: 7, defense: 8, specialMove: "Ice Age" },
  { id: 3, name: "Lady Lush", attack: 6, defense: 6, specialMove: "Drunken Master" },
  { id: 4, name: "Chainsaw Charlie", attack: 10, defense: 5, specialMove: "Timber!" },
];

export const GameBoard = ({ onExit }) => {
  const [playerTeddies, setPlayerTeddies] = useState(initialTeddies.slice(0, 2));
  const [opponentTeddies, setOpponentTeddies] = useState(initialTeddies.slice(2, 4));

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
        <p className="text-2xl">Battle Area</p>
      </div>
      <div className="player-area">
        <h2 className="text-2xl font-bold mb-4">Your Teddies</h2>
        <div className="flex space-x-4 mb-4">
          {playerTeddies.map(teddy => (
            <TeddyCard key={teddy.id} teddy={teddy} />
          ))}
        </div>
        <Button onClick={onExit} className="bg-blue-600 hover:bg-blue-700">
          Exit Game
        </Button>
      </div>
    </div>
  );
};
