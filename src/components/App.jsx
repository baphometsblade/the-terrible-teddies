import React, { useState } from 'react';
import { Button } from "@/components/ui/button";

const App = () => {
  const [gameStarted, setGameStarted] = useState(false);

  const startGame = () => {
    setGameStarted(true);
  };

  return (
    <div className="min-h-screen bg-purple-900 flex flex-col items-center justify-center text-white p-4">
      <h1 className="text-6xl font-bold mb-8 text-center">Terrible Teddies</h1>
      {!gameStarted ? (
        <Button onClick={startGame} className="bg-red-600 hover:bg-red-700 text-white font-bold py-3 px-6 rounded-lg text-xl">
          Start Game
        </Button>
      ) : (
        <div className="text-2xl">Game in progress...</div>
      )}
    </div>
  );
};

export default App;
