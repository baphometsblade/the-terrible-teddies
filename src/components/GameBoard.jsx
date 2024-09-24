import React from 'react';
import { Button } from "@/components/ui/button";

export const GameBoard = ({ onExit }) => {
  return (
    <div className="game-board p-4 bg-purple-800 bg-opacity-80 rounded-lg shadow-2xl">
      <h2 className="text-2xl font-bold mb-4 text-purple-200">Game Board</h2>
      <p className="mb-4 text-purple-300">Game in progress...</p>
      <Button onClick={onExit} className="bg-red-600 hover:bg-red-700 text-white">
        Exit Game
      </Button>
    </div>
  );
};
