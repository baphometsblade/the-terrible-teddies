import React, { useState, useEffect } from 'react';
import TeddyCard from './TeddyCard';
import { Button } from "@/components/ui/button";
import { calculateDamage } from '../utils/gameLogic';

const Game = () => {
  const [playerTeddy, setPlayerTeddy] = useState(null);
  const [opponentTeddy, setOpponentTeddy] = useState(null);
  const [playerHealth, setPlayerHealth] = useState(30);
  const [opponentHealth, setOpponentHealth] = useState(30);
  const [currentTurn, setCurrentTurn] = useState('player');

  useEffect(() => {
    // For now, we'll use placeholder teddies. Later, we'll fetch these from the database.
    setPlayerTeddy({
      name: "Whiskey Whiskers",
      title: "The Smooth Operator",
      attack: 6,
      defense: 5,
      specialMove: "On the Rocks"
    });
    setOpponentTeddy({
      name: "Madame Mistletoe",
      title: "The Festive Flirt",
      attack: 5,
      defense: 6,
      specialMove: "Sneak Kiss"
    });
  }, []);

  const handleAttack = () => {
    if (currentTurn === 'player') {
      const damage = calculateDamage(playerTeddy, opponentTeddy);
      setOpponentHealth(prev => Math.max(0, prev - damage));
      setCurrentTurn('opponent');
      setTimeout(opponentTurn, 1000);
    }
  };

  const opponentTurn = () => {
    const damage = calculateDamage(opponentTeddy, playerTeddy);
    setPlayerHealth(prev => Math.max(0, prev - damage));
    setCurrentTurn('player');
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-4 text-center text-purple-600">Battle Arena</h1>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <h2 className="text-2xl font-bold mb-2">Your Teddy</h2>
          {playerTeddy && <TeddyCard teddy={playerTeddy} />}
          <p>Health: {playerHealth}</p>
        </div>
        <div>
          <h2 className="text-2xl font-bold mb-2">Opponent's Teddy</h2>
          {opponentTeddy && <TeddyCard teddy={opponentTeddy} />}
          <p>Health: {opponentHealth}</p>
        </div>
      </div>
      <div className="mt-4">
        <Button onClick={handleAttack} disabled={currentTurn !== 'player'}>Attack</Button>
      </div>
    </div>
  );
};

export default Game;