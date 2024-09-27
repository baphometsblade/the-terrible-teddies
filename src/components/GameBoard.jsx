import React, { useState, useEffect } from 'react';
import TeddyBear from './TeddyBear';
import { Button } from "@/components/ui/button";

const initialTeddies = [
  { id: 1, name: "Blitzkrieg Bear", title: "The Speed Demon", attack: 9, defense: 7, specialMove: "Total Annihilation", description: "A bear with a need for speed and destruction.", imageUrl: "https://via.placeholder.com/150" },
  { id: 2, name: "Icy Ivan", title: "The Frosty Fighter", attack: 7, defense: 8, specialMove: "Ice Age", description: "A bear with a heart of ice and fists of fury.", imageUrl: "https://via.placeholder.com/150" },
  { id: 3, name: "Lady Lush", title: "The Party Animal", attack: 6, defense: 6, specialMove: "Drunken Master", description: "A bear who's always ready for a good time and a brawl.", imageUrl: "https://via.placeholder.com/150" },
  { id: 4, name: "Chainsaw Charlie", title: "The Lumberjack", attack: 10, defense: 5, specialMove: "Timber!", description: "A bear with a passion for cutting down the competition.", imageUrl: "https://via.placeholder.com/150" },
];

const GameBoard = () => {
  const [playerTeddy, setPlayerTeddy] = useState(null);
  const [opponentTeddy, setOpponentTeddy] = useState(null);
  const [gameState, setGameState] = useState('selection');
  const [playerHealth, setPlayerHealth] = useState(30);
  const [opponentHealth, setOpponentHealth] = useState(30);

  useEffect(() => {
    if (gameState === 'battle' && (playerHealth <= 0 || opponentHealth <= 0)) {
      setGameState('gameOver');
    }
  }, [playerHealth, opponentHealth]);

  const selectTeddy = (teddy) => {
    setPlayerTeddy(teddy);
    const remainingTeddies = initialTeddies.filter(t => t.id !== teddy.id);
    setOpponentTeddy(remainingTeddies[Math.floor(Math.random() * remainingTeddies.length)]);
    setGameState('battle');
  };

  const attack = (attacker, defender, setDefenderHealth) => {
    const damage = Math.max(0, attacker.attack - defender.defense);
    setDefenderHealth(prevHealth => Math.max(0, prevHealth - damage));
  };

  const handlePlayerAttack = () => {
    attack(playerTeddy, opponentTeddy, setOpponentHealth);
  };

  const handlePlayerDefend = () => {
    // Increase defense temporarily
    setPlayerTeddy(prev => ({ ...prev, defense: prev.defense + 2 }));
  };

  const handlePlayerSpecial = () => {
    // Implement special move logic here
    console.log(`${playerTeddy.name} used ${playerTeddy.specialMove}!`);
  };

  const handleOpponentTurn = () => {
    const actions = [
      () => attack(opponentTeddy, playerTeddy, setPlayerHealth),
      () => console.log(`${opponentTeddy.name} defends`),
      () => console.log(`${opponentTeddy.name} used ${opponentTeddy.specialMove}!`),
    ];
    actions[Math.floor(Math.random() * actions.length)]();
  };

  const resetGame = () => {
    setPlayerTeddy(null);
    setOpponentTeddy(null);
    setGameState('selection');
    setPlayerHealth(30);
    setOpponentHealth(30);
  };

  if (gameState === 'selection') {
    return (
      <div className="p-4">
        <h2 className="text-2xl font-bold mb-4">Choose your Terrible Teddy</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {initialTeddies.map(teddy => (
            <TeddyBear key={teddy.id} bear={teddy} onAttack={() => selectTeddy(teddy)} />
          ))}
        </div>
      </div>
    );
  }

  if (gameState === 'battle') {
    return (
      <div className="p-4">
        <h2 className="text-2xl font-bold mb-4">Battle!</h2>
        <div className="flex justify-between">
          <div>
            <h3>Your Teddy</h3>
            <TeddyBear bear={playerTeddy} onAttack={handlePlayerAttack} onDefend={handlePlayerDefend} onUseSpecialMove={handlePlayerSpecial} />
            <p>Health: {playerHealth}</p>
          </div>
          <div>
            <h3>Opponent's Teddy</h3>
            <TeddyBear bear={opponentTeddy} />
            <p>Health: {opponentHealth}</p>
          </div>
        </div>
        <Button onClick={handleOpponentTurn} className="mt-4">End Turn</Button>
      </div>
    );
  }

  if (gameState === 'gameOver') {
    return (
      <div className="p-4 text-center">
        <h2 className="text-2xl font-bold mb-4">Game Over</h2>
        <p>{playerHealth <= 0 ? "You lost!" : "You won!"}</p>
        <Button onClick={resetGame} className="mt-4">Play Again</Button>
      </div>
    );
  }
};

export default GameBoard;