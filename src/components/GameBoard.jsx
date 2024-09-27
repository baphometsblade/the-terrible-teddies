import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import TeddyCard from './TeddyCard';

const GameBoard = () => {
  const [playerTeddy, setPlayerTeddy] = useState(null);
  const [opponentTeddy, setOpponentTeddy] = useState(null);
  const [gameState, setGameState] = useState('selecting'); // 'selecting', 'battle', 'gameOver'

  const handleTeddySelect = (teddy) => {
    setPlayerTeddy(teddy);
    // For now, we'll just set a random opponent teddy
    setOpponentTeddy({
      name: "Opponent Teddy",
      attack: Math.floor(Math.random() * 5) + 1,
      defense: Math.floor(Math.random() * 5) + 1,
    });
    setGameState('battle');
  };

  const handleAttack = () => {
    // Implement battle logic here
    setGameState('gameOver');
  };

  const resetGame = () => {
    setPlayerTeddy(null);
    setOpponentTeddy(null);
    setGameState('selecting');
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-4xl font-bold mb-4 text-center text-purple-600">Terrible Teddies Battle</h1>
      {gameState === 'selecting' && (
        <div>
          <h2 className="text-2xl font-bold mb-4">Select Your Teddy</h2>
          <div className="grid grid-cols-3 gap-4">
            {[1, 2, 3].map((id) => (
              <TeddyCard
                key={id}
                teddy={{ name: `Teddy ${id}`, attack: id, defense: 4 - id }}
                onSelect={() => handleTeddySelect({ name: `Teddy ${id}`, attack: id, defense: 4 - id })}
              />
            ))}
          </div>
        </div>
      )}
      {gameState === 'battle' && playerTeddy && opponentTeddy && (
        <div className="flex justify-between">
          <TeddyCard teddy={playerTeddy} />
          <div className="flex flex-col items-center justify-center">
            <Button onClick={handleAttack} className="mb-4">Attack</Button>
          </div>
          <TeddyCard teddy={opponentTeddy} />
        </div>
      )}
      {gameState === 'gameOver' && (
        <div className="text-center">
          <h2 className="text-3xl font-bold mb-4">Game Over</h2>
          <Button onClick={resetGame}>Play Again</Button>
        </div>
      )}
    </div>
  );
};

export default GameBoard;