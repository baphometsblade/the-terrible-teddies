import React, { useState, useEffect } from 'react';
import TeddyCard from './TeddyCard';
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";

const Battle = ({ playerTeddy, opponentTeddy }) => {
  const [playerHealth, setPlayerHealth] = useState(30);
  const [opponentHealth, setOpponentHealth] = useState(30);
  const [currentTurn, setCurrentTurn] = useState('player');
  const { toast } = useToast();

  const attack = (attacker, defender, setDefenderHealth) => {
    const damage = Math.max(0, attacker.attack - defender.defense);
    setDefenderHealth(prev => Math.max(0, prev - damage));
    return damage;
  };

  const handlePlayerAttack = () => {
    if (currentTurn !== 'player') return;
    const damage = attack(playerTeddy, opponentTeddy, setOpponentHealth);
    toast({
      title: "Player Attack",
      description: `${playerTeddy.name} deals ${damage} damage!`,
    });
    setCurrentTurn('opponent');
  };

  useEffect(() => {
    if (currentTurn === 'opponent') {
      setTimeout(() => {
        const damage = attack(opponentTeddy, playerTeddy, setPlayerHealth);
        toast({
          title: "Opponent Attack",
          description: `${opponentTeddy.name} deals ${damage} damage!`,
        });
        setCurrentTurn('player');
      }, 1000);
    }
  }, [currentTurn, opponentTeddy, playerTeddy]);

  useEffect(() => {
    if (playerHealth <= 0 || opponentHealth <= 0) {
      toast({
        title: "Battle Over",
        description: playerHealth > opponentHealth ? "You win!" : "You lose!",
        variant: playerHealth > opponentHealth ? "success" : "destructive",
      });
    }
  }, [playerHealth, opponentHealth]);

  return (
    <div className="flex flex-col items-center">
      <div className="flex justify-between w-full mb-4">
        <div>
          <TeddyCard teddy={playerTeddy} />
          <p>Health: {playerHealth}</p>
        </div>
        <div>
          <TeddyCard teddy={opponentTeddy} />
          <p>Health: {opponentHealth}</p>
        </div>
      </div>
      <Button onClick={handlePlayerAttack} disabled={currentTurn !== 'player' || playerHealth <= 0 || opponentHealth <= 0}>
        Attack
      </Button>
    </div>
  );
};

export default Battle;