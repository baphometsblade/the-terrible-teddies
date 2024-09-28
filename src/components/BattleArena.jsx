import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import TeddyCard from './TeddyCard';
import { calculateDamage } from '../utils/battleLogic';

const BattleArena = ({ playerTeddy, opponentTeddy }) => {
  const [playerHealth, setPlayerHealth] = useState(30);
  const [opponentHealth, setOpponentHealth] = useState(30);
  const [playerEnergy, setPlayerEnergy] = useState(3);
  const [opponentEnergy, setOpponentEnergy] = useState(3);
  const [battleLog, setBattleLog] = useState([]);
  const [currentTurn, setCurrentTurn] = useState('player');

  useEffect(() => {
    if (currentTurn === 'opponent') {
      setTimeout(opponentTurn, 1000);
    }
  }, [currentTurn]);

  const addToBattleLog = (message) => {
    setBattleLog(prevLog => [...prevLog, message]);
  };

  const attack = () => {
    const damage = calculateDamage(playerTeddy, opponentTeddy);
    setOpponentHealth(prev => Math.max(0, prev - damage));
    addToBattleLog(`${playerTeddy.name} attacks for ${damage} damage!`);
    endTurn();
  };

  const defend = () => {
    setPlayerTeddy(prev => ({ ...prev, defense: prev.defense + 2 }));
    addToBattleLog(`${playerTeddy.name} increases defense by 2!`);
    endTurn();
  };

  const useSpecialMove = () => {
    if (playerEnergy >= 2) {
      setPlayerEnergy(prev => prev - 2);
      // Implement special move logic here
      addToBattleLog(`${playerTeddy.name} uses ${playerTeddy.specialMove}!`);
      endTurn();
    }
  };

  const endTurn = () => {
    setCurrentTurn('opponent');
  };

  const opponentTurn = () => {
    // Simple AI: randomly choose between attack and defend
    if (Math.random() > 0.5) {
      const damage = calculateDamage(opponentTeddy, playerTeddy);
      setPlayerHealth(prev => Math.max(0, prev - damage));
      addToBattleLog(`${opponentTeddy.name} attacks for ${damage} damage!`);
    } else {
      setOpponentTeddy(prev => ({ ...prev, defense: prev.defense + 2 }));
      addToBattleLog(`${opponentTeddy.name} increases defense by 2!`);
    }
    setCurrentTurn('player');
  };

  if (playerHealth <= 0 || opponentHealth <= 0) {
    return (
      <div className="text-center">
        <h2 className="text-2xl font-bold mb-4">
          {playerHealth <= 0 ? 'You Lost!' : 'You Won!'}
        </h2>
        <Button onClick={() => window.location.reload()}>Play Again</Button>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4">
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <h2 className="text-xl font-bold mb-2">Your Teddy</h2>
          <TeddyCard teddy={playerTeddy} />
          <p>Health: {playerHealth}/30</p>
          <p>Energy: {playerEnergy}/3</p>
        </div>
        <div>
          <h2 className="text-xl font-bold mb-2">Opponent's Teddy</h2>
          <TeddyCard teddy={opponentTeddy} />
          <p>Health: {opponentHealth}/30</p>
          <p>Energy: {opponentEnergy}/3</p>
        </div>
      </div>
      <div className="mb-4">
        <Button onClick={attack} disabled={currentTurn !== 'player'} className="mr-2">Attack</Button>
        <Button onClick={defend} disabled={currentTurn !== 'player'} className="mr-2">Defend</Button>
        <Button onClick={useSpecialMove} disabled={currentTurn !== 'player' || playerEnergy < 2}>Use Special Move</Button>
      </div>
      <div>
        <h3 className="text-lg font-bold mb-2">Battle Log</h3>
        <ul className="list-disc list-inside">
          {battleLog.map((log, index) => (
            <li key={index}>{log}</li>
          ))}
        </ul>
      </div>
    </div>
  );
};

export default BattleArena;