import React, { useState } from 'react';
import BattleArena from './components/BattleArena';
import { Button } from "@/components/ui/button";

const App = () => {
  const [gameState, setGameState] = useState('menu');
  const [playerBear, setPlayerBear] = useState({
    name: "Whiskey Whiskers",
    title: "The Smooth Operator",
    description: "A suave bear with a penchant for fine spirits and even finer company.",
    attack: 6,
    defense: 5,
    specialMove: "On the Rocks",
    imageUrl: "https://via.placeholder.com/150"
  });
  const [opponentBear, setOpponentBear] = useState({
    name: "Madame Mistletoe",
    title: "The Festive Flirt",
    description: "She carries mistletoe year-round, believing every moment is an opportunity for a sly kiss.",
    attack: 5,
    defense: 6,
    specialMove: "Sneak Kiss",
    imageUrl: "https://via.placeholder.com/150"
  });

  const startGame = () => setGameState('playing');
  const returnToMenu = () => setGameState('menu');

  const handleEndTurn = () => {
    // Implement turn-based logic here
    console.log("Turn ended");
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-4xl font-bold mb-4 text-center">Cheeky Teddy Brawl</h1>
      {gameState === 'menu' ? (
        <div className="text-center">
          <Button onClick={startGame} className="bg-green-500 hover:bg-green-600 text-white font-bold py-2 px-4 rounded">
            Start Game
          </Button>
        </div>
      ) : (
        <div>
          <BattleArena
            playerBear={playerBear}
            opponentBear={opponentBear}
            onEndTurn={handleEndTurn}
          />
          <div className="mt-4 text-center">
            <Button onClick={returnToMenu} className="bg-red-500 hover:bg-red-600 text-white font-bold py-2 px-4 rounded">
              Return to Menu
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;