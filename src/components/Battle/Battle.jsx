import React, { useState, useEffect } from 'react';
import { useToast } from "@/components/ui/use-toast";
import { calculateDamage } from '../../utils/battleSystem';
import BattleField from './BattleField';
import ActionButtons from './ActionButtons';
import BattleLog from './BattleLog';

const Battle = ({ playerTeddy, opponentTeddy, onBattleEnd }) => {
  const [playerHealth, setPlayerHealth] = useState(30);
  const [opponentHealth, setOpponentHealth] = useState(30);
  const [playerEnergy, setPlayerEnergy] = useState(3);
  const [opponentEnergy, setOpponentEnergy] = useState(3);
  const [currentTurn, setCurrentTurn] = useState('player');
  const [battleLog, setBattleLog] = useState([]);
  const [isAnimating, setIsAnimating] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (currentTurn === 'opponent') {
      setTimeout(opponentTurn, 1000);
    }
  }, [currentTurn]);

  const performAction = (action) => {
    if (currentTurn !== 'player' || isAnimating) return;

    setIsAnimating(true);
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
          setIsAnimating(false);
          return;
        }
        break;
    }

    setTimeout(() => {
      checkGameOver();
      setCurrentTurn('opponent');
      setIsAnimating(false);
    }, 1000);
  };

  const opponentTurn = () => {
    setIsAnimating(true);
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

    setTimeout(() => {
      checkGameOver();
      setCurrentTurn('player');
      setIsAnimating(false);
    }, 1000);
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
      <BattleField 
        playerTeddy={playerTeddy}
        opponentTeddy={opponentTeddy}
        playerHealth={playerHealth}
        opponentHealth={opponentHealth}
        playerEnergy={playerEnergy}
        opponentEnergy={opponentEnergy}
        currentTurn={currentTurn}
      />
      <ActionButtons 
        onAction={performAction}
        isDisabled={currentTurn !== 'player' || isAnimating}
        playerEnergy={playerEnergy}
      />
      <BattleLog log={battleLog} />
    </div>
  );
};

export default Battle;