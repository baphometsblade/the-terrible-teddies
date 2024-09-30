import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import TeddyCard from './TeddyCard';
import { useToast } from "@/components/ui/use-toast";

const Battle = () => {
  const [playerTeddy, setPlayerTeddy] = useState(null);
  const [opponentTeddy, setOpponentTeddy] = useState(null);
  const [playerHealth, setPlayerHealth] = useState(30);
  const [opponentHealth, setOpponentHealth] = useState(30);
  const [currentTurn, setCurrentTurn] = useState('player');
  const { toast } = useToast();

  useEffect(() => {
    // Simulating fetching player's teddy and generating an opponent
    setPlayerTeddy({
      name: "Whiskey Whiskers",
      attack: 7,
      defense: 5,
      specialMove: "On the Rocks"
    });
    setOpponentTeddy({
      name: "Madame Mistletoe",
      attack: 6,
      defense: 6,
      specialMove: "Sneak Kiss"
    });
  }, []);

  const handleAttack = () => {
    if (currentTurn === 'player') {
      const damage = Math.max(playerTeddy.attack - opponentTeddy.defense, 1);
      setOpponentHealth(prev => Math.max(prev - damage, 0));
      setCurrentTurn('opponent');
      toast({
        title: "Player Attack",
        description: `${playerTeddy.name} deals ${damage} damage!`,
      });
      setTimeout(opponentTurn, 1000);
    }
  };

  const opponentTurn = () => {
    const damage = Math.max(opponentTeddy.attack - playerTeddy.defense, 1);
    setPlayerHealth(prev => Math.max(prev - damage, 0));
    setCurrentTurn('player');
    toast({
      title: "Opponent Attack",
      description: `${opponentTeddy.name} deals ${damage} damage!`,
    });
  };

  const checkGameOver = () => {
    if (playerHealth <= 0) {
      toast({
        title: "Game Over",
        description: "You lost the battle!",
        variant: "destructive",
      });
    } else if (opponentHealth <= 0) {
      toast({
        title: "Victory",
        description: "You won the battle!",
        variant: "success",
      });
    }
  };

  useEffect(() => {
    checkGameOver();
  }, [playerHealth, opponentHealth]);

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-6">Battle Arena</h1>
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <h2 className="text-xl font-bold">Player</h2>
          {playerTeddy && <TeddyCard teddy={playerTeddy} />}
          <p>Health: {playerHealth}</p>
        </div>
        <div>
          <h2 className="text-xl font-bold">Opponent</h2>
          {opponentTeddy && <TeddyCard teddy={opponentTeddy} />}
          <p>Health: {opponentHealth}</p>
        </div>
      </div>
      <Button onClick={handleAttack} disabled={currentTurn !== 'player'}>
        Attack
      </Button>
    </div>
  );
};

export default Battle;