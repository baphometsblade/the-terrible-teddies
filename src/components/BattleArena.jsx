import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import TeddyCard from './TeddyCard';

const BattleArena = ({ playerTeddy, opponentTeddy, onBattleEnd }) => {
  const [playerHealth, setPlayerHealth] = useState(30);
  const [opponentHealth, setOpponentHealth] = useState(30);
  const [currentTurn, setCurrentTurn] = useState('player');
  const [battleLog, setBattleLog] = useState([]);

  useEffect(() => {
    if (playerHealth <= 0) {
      onBattleEnd('lose');
    } else if (opponentHealth <= 0) {
      onBattleEnd('win');
    }
  }, [playerHealth, opponentHealth]);

  const attack = (attacker, defender, setDefenderHealth) => {
    const damage = Math.max(0, attacker.attack - defender.defense);
    setDefenderHealth(prevHealth => Math.max(0, prevHealth - damage));
    setBattleLog(prevLog => [...prevLog, `${attacker.name} attacks ${defender.name} for ${damage} damage!`]);
  };

  const handlePlayerAttack = () => {
    attack(playerTeddy, opponentTeddy, setOpponentHealth);
    setCurrentTurn('opponent');
    setTimeout(() => {
      attack(opponentTeddy, playerTeddy, setPlayerHealth);
      setCurrentTurn('player');
    }, 1000);
  };

  return (
    <div className="flex flex-col items-center">
      <div className="flex justify-between w-full mb-4">
        <div className="text-center">
          <TeddyCard teddy={playerTeddy} isPlayable={false} />
          <p>Health: {playerHealth}</p>
        </div>
        <div className="text-center">
          <TeddyCard teddy={opponentTeddy} isPlayable={false} />
          <p>Health: {opponentHealth}</p>
        </div>
      </div>
      <Button onClick={handlePlayerAttack} disabled={currentTurn !== 'player'} className="mb-4">
        Attack!
      </Button>
      <div className="w-full max-h-40 overflow-y-auto bg-gray-100 p-4 rounded">
        {battleLog.map((log, index) => (
          <p key={index}>{log}</p>
        ))}
      </div>
    </div>
  );
};

export default BattleArena;