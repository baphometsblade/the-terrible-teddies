import React, { useState } from 'react';
import { GameBoard } from '../components/GameBoard';
import { Button } from "@/components/ui/button";

const Index = () => {
  const [gameStarted, setGameStarted] = useState(false);

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 to-indigo-900 p-8">
      {!gameStarted ? (
        <div className="text-center">
          <h1 className="text-6xl font-bold mb-8 text-purple-300">Terrible Teddies</h1>
          <Button 
            onClick={() => setGameStarted(true)}
            className="bg-red-600 hover:bg-red-700 text-white font-bold py-3 px-6 rounded-lg text-xl"
          >
            Start Game
          </Button>
        </div>
      ) : (
        <GameBoard />
      )}
    </div>
  );
};

export default Index;
