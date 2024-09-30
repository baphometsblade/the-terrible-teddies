import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import TeddyCard from './TeddyCard';

const Battle = ({ playerTeddy, opponentTeddy, onBattleEnd }) => {
  const [playerHealth, setPlayerHealth] = useState(30);
  const [opponentHealth, setOpponentHealth] = useState(30);
  const [currentTurn, setCurrentTurn] = useState('player');
  const { toast } = useToast();

  useEffect(() => {
    if (currentTurn === 'opponent') {
      setTimeout(opponentTurn, 1000);
    }
  }, [currentTurn]);

  const attack = (attacker, defender, setDefenderHealth) => {
    const damage = Math.max(0, attacker.attack - defender.defense);
    setDefenderHealth(prev => Math.max(0, prev - damage));
    return damage;
  };

  const playerAttack = () => {
    const damage = attack(playerTeddy, opponentTeddy, setOpponentHealth);
    toast({
      title: "Player Attack",
      description: `${playerTeddy.name} deals ${damage} damage!`,
    });
    setCurrentTurn('opponent');
  };

  const opponentTurn = () => {
    const damage = attack(opponentTeddy, playerTeddy, setPlayerHealth);
    toast({
      title: "Opponent Attack",
      description: `${opponentTeddy.name} deals ${damage} damage!`,
    });
    setCurrentTurn('player');
  };

  useEffect(() => {
    if (playerHealth === 0 || opponentHealth === 0) {
      onBattleEnd(playerHealth > opponentHealth ? 'win' : 'lose');
    }
  }, [playerHealth, opponentHealth, onBattleEnd]);

  return (
    <div className="battle-arena p-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <h2 className="text-xl font-bold mb-2">Your Teddy</h2>
          <TeddyCard teddy={playerTeddy} />
          <p>Health: {playerHealth}</p>
        </div>
        <div>
          <h2 className="text-xl font-bold mb-2">Opponent's Teddy</h2>
          <TeddyCard teddy={opponentTeddy} />
          <p>Health: {opponentHealth}</p>
        </div>
      </div>
      <Button 
        onClick={playerAttack} 
        disabled={currentTurn !== 'player' || playerHealth === 0 || opponentHealth === 0}
        className="mt-4"
      >
        Attack
      </Button>
    </div>
  );
};

export default Battle;