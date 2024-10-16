import React from 'react';
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import TeddyCard from '../TeddyCard';

const GameBoard = () => {
  // Placeholder data for demonstration
  const playerHand = [1, 2, 3, 4, 5];
  const playerField = [1, 2];
  const opponentField = [1, 2, 3];

  return (
    <div className="relative w-full h-screen bg-amber-100 overflow-hidden">
      {/* Top decorative border */}
      <div className="absolute top-0 left-0 right-0 h-16 bg-gradient-to-r from-brown-800 to-brown-600 flex items-center justify-between px-4">
        <div className="text-white font-bold">Opponent</div>
        <div className="flex items-center space-x-2">
          <div className="w-8 h-8 bg-blue-500 rounded-full"></div>
          <div className="text-white">30</div>
        </div>
      </div>

      {/* Opponent's field */}
      <div className="absolute top-20 left-1/2 transform -translate-x-1/2 flex justify-center space-x-2">
        {opponentField.map((card, index) => (
          <Card key={index} className="w-16 h-24 bg-red-200 flex items-center justify-center">
            {card}
          </Card>
        ))}
      </div>

      {/* Main game board */}
      <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-4/5 h-2/3 bg-amber-200 rounded-lg border-4 border-brown-600 flex flex-col justify-between p-4">
        {/* Player's field */}
        <div className="flex justify-center space-x-2 mt-auto">
          {playerField.map((card, index) => (
            <Card key={index} className="w-20 h-28 bg-green-200 flex items-center justify-center">
              {card}
            </Card>
          ))}
        </div>
      </div>

      {/* Player's hand */}
      <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex justify-center space-x-2">
        {playerHand.map((card, index) => (
          <TeddyCard key={index} teddy={{ name: `Teddy ${card}`, attack: 2, defense: 2 }} />
        ))}
      </div>

      {/* Bottom decorative border */}
      <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-r from-brown-800 to-brown-600 flex items-center justify-between px-4">
        <div className="text-white font-bold">Player</div>
        <div className="flex items-center space-x-2">
          <div className="w-8 h-8 bg-green-500 rounded-full"></div>
          <div className="text-white">30</div>
        </div>
      </div>

      {/* End Turn button */}
      <Button className="absolute bottom-20 right-4 bg-green-500 hover:bg-green-600 text-white">
        End Turn
      </Button>
    </div>
  );
};

export default GameBoard;