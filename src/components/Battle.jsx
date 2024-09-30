import React, { useState, useEffect } from 'react';
import { useToast } from "@/components/ui/use-toast";
import TeddyCard from './TeddyCard';
import { Button } from "@/components/ui/button";
import { calculateDamage } from '../utils/battleUtils';
import AIOpponent from '../utils/AIOpponent';

const Battle = () => {
  const [playerTeddy, setPlayerTeddy] = useState(null);
  const [opponentTeddy, setOpponentTeddy] = useState(null);
  const [playerHealth, setPlayerHealth] = useState(30);
  const [opponentHealth, setOpponentHealth] = useState(30);
  const [playerEnergy, setPlayerEnergy] = useState(3);
  const [opponentEnergy, setOpponentEnergy] = useState(3);
  const [currentTurn, setCurrentTurn] = useState('player');
  const [battleLog, setBattleLog] = useState([]);
  const { toast } = useToast();

  useEffect(() => {
    // Simulating fetching player's teddy and generating an opponent
    setPlayerTeddy({
      name: "Whiskey Whiskers",
      attack: 7,
      defense: 5,
      specialMove: "On the Rocks",
      specialMoveCost: 2,
      specialMoveEffect: "Stun opponent for 1 turn"
    });
    setOpponentTeddy(AIOpponent.generateTeddy());
  }, []);

  useEffect(() => {
    if (currentTurn === 'opponent') {
      setTimeout(opponentTurn, 1000);
    }
  }, [currentTurn]);

  const handleAction = (action) => {
    if (currentTurn !== 'player') return;

    let damage = 0;
    switch (action) {
      case 'attack':
        damage = calculateDamage(playerTeddy, opponentTeddy);
        setOpponentHealth(prev => Math.max(0, prev - damage));
        addToBattleLog(`${playerTeddy.name} attacks for ${damage} damage!`);
        break;
      case 'defend':
        setPlayerTeddy(prev => ({ ...prev, defense: prev.defense + 2 }));
        addToBattleLog(`${playerTeddy.name} increases defense by 2!`);
        break;
      case 'special':
        if (playerEnergy >= playerTeddy.specialMoveCost) {
          setPlayerEnergy(prev => prev - playerTeddy.specialMoveCost);
          // Implement special move logic here
          addToBattleLog(`${playerTeddy.name} uses ${playerTeddy.specialMove}!`);
          addToBattleLog(playerTeddy.specialMoveEffect);
        } else {
          toast({
            title: "Not enough energy",
            description: `You need ${playerTeddy.specialMoveCost} energy to use a special move.`,
            variant: "destructive",
          });
          return;
        }
        break;
    }

    checkGameOver();
    setCurrentTurn('opponent');
    setPlayerEnergy(Math.min(playerEnergy + 1, 3));
  };

  const opponentTurn = () => {
    const action = AIOpponent.chooseAction(opponentTeddy, playerTeddy, opponentEnergy);
    let damage = 0;

    switch (action) {
      case 'attack':
        damage = calculateDamage(opponentTeddy, playerTeddy);
        setPlayerHealth(prev => Math.max(0, prev - damage));
        addToBattleLog(`${opponentTeddy.name} attacks for ${damage} damage!`);
        break;
      case 'defend':
        setOpponentTeddy(prev => ({ ...prev, defense: prev.defense + 2 }));
        addToBattleLog(`${opponentTeddy.name} increases defense by 2!`);
        break;
      case 'special':
        if (opponentEnergy >= opponentTeddy.specialMoveCost) {
          setOpponentEnergy(prev => prev - opponentTeddy.specialMoveCost);
          // Implement opponent special move logic here
          addToBattleLog(`${opponentTeddy.name} uses ${opponentTeddy.specialMove}!`);
          addToBattleLog(opponentTeddy.specialMoveEffect);
        }
        break;
    }

    checkGameOver();
    setCurrentTurn('player');
    setOpponentEnergy(Math.min(opponentEnergy + 1, 3));
  };

  const addToBattleLog = (message) => {
    setBattleLog(prev => [...prev, message]);
  };

  const checkGameOver = () => {
    if (playerHealth <= 0) {
      toast({
        title: "Game Over",
        description: "You lost the battle!",
        variant: "destructive",
      });
      // Handle game over logic
    } else if (opponentHealth <= 0) {
      toast({
        title: "Victory!",
        description: "You won the battle!",
        variant: "success",
      });
      // Handle victory logic
    }
  };

  if (!playerTeddy || !opponentTeddy) return <div>Loading battle...</div>;

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-4">Battle Arena</h1>
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
        <Button onClick={() => handleAction('attack')} disabled={currentTurn !== 'player'}>Attack</Button>
        <Button onClick={() => handleAction('defend')} disabled={currentTurn !== 'player'} className="ml-2">Defend</Button>
        <Button onClick={() => handleAction('special')} disabled={currentTurn !== 'player' || playerEnergy < playerTeddy.specialMoveCost} className="ml-2">Special Move</Button>
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

export default Battle;