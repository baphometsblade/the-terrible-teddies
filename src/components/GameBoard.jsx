import React from 'react';
import { Button } from "@/components/ui/button";

export const GameBoard = ({ onExitGame }) => {
  return (
    <div className="bg-purple-800 p-8 rounded-lg shadow-2xl text-white">
      <h2 className="text-3xl font-bold mb-4">Game Board</h2>
      <p className="mb-4">Game content will go here...</p>
      <Button 
        onClick={onExitGame}
        className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded"
      >
        Exit Game
      </Button>
    </div>
  );
};
