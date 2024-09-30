import React, { useState, useEffect } from 'react';
import { useToast } from "@/components/ui/use-toast";
import TeddyCard from '../TeddyCard';
import { calculateDamage } from '../../utils/battleUtils';
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import BattleLog from './BattleLog';

const Battle = ({ playerTeddy, opponentTeddy, onBattleEnd }) => {
  const [playerHealth, setPlayerHealth] = useState(30);
  const [opponentHealth, setOpponentHealth] = useState(30);
  const [playerEnergy, setPlayerEnergy] = useState(3);
  const [opponentEnergy, setOpponentEnergy] = useState(3);
  const [currentTurn, setCurrentTurn] = useState('player');
  const [battleLog, setBattleLog] = useState([]);
  const { toast } = useToast();

  useEffect(() => {
    if (currentTurn === 'opponent') {
      setTimeout(opponentTurn, 1000);
    }
  }, [currentTurn]);

  const performAction = (action) => {
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
        if (playerEnergy >= 2) {
          setPlayerEnergy(prev => prev - 2);
          // Implement special move logic here
          addToBattleLog(`${playerTeddy.name} uses ${playerTeddy.specialMove}!`);
        } else {
          toast({
            title: "Not enough energy",
            description: "You need 2 energy to use a special move.",
            variant: "destructive",
          });
          return;
        }
        break;
    }

    checkGameOver();
    setCurrentTurn('opponent');
    setPlayerEnergy(prev => Math.min(prev + 1, 3));
  };

  const opponentTurn = () => {
    const action = Math.random() > 0.3 ? 'attack' : 'defend';
    let damage = 0;

    if (action === 'attack') {
      damage = calculateDamage(opponentTeddy, playerTeddy);
      setPlayerHealth(prev => Math.max(0, prev - damage));
      addToBattleLog(`${opponentTeddy.name} attacks for ${damage} damage!`);
    } else {
      setOpponentTeddy(prev => ({ ...prev, defense: prev.defense + 2 }));
      addToBattleLog(`${opponentTeddy.name} increases defense by 2!`);
    }

    checkGameOver();
    setCurrentTurn('player');
    setOpponentEnergy(prev => Math.min(prev + 1, 3));
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
      onBattleEnd('loss');
    } else if (opponentHealth <= 0) {
      toast({
        title: "Victory!",
        description: "You won the battle!",
        variant: "success",
      });
      onBattleEnd('win');
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-4">Battle Arena</h1>
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <h2 className="text-xl font-bold mb-2">Your Teddy</h2>
          <TeddyCard teddy={playerTeddy} />
          <Progress value={(playerHealth / 30) * 100} className="mt-2" />
          <p>Health: {playerHealth}/30</p>
          <p>Energy: {playerEnergy}/3</p>
        </div>
        <div>
          <h2 className="text-xl font-bold mb-2">Opponent's Teddy</h2>
          <TeddyCard teddy={opponentTeddy} />
          <Progress value={(opponentHealth / 30) * 100} className="mt-2" />
          <p>Health: {opponentHealth}/30</p>
          <p>Energy: {opponentEnergy}/3</p>
        </div>
      </div>
      <div className="mb-4">
        <Button onClick={() => performAction('attack')} disabled={currentTurn !== 'player'}>Attack</Button>
        <Button onClick={() => performAction('defend')} disabled={currentTurn !== 'player'} className="ml-2">Defend</Button>
        <Button onClick={() => performAction('special')} disabled={currentTurn !== 'player' || playerEnergy < 2} className="ml-2">Special Move</Button>
      </div>
      <BattleLog log={battleLog} />
    </div>
  );
};

export default Battle;