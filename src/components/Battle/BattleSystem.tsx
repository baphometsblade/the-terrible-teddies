import React, { useState, useEffect } from 'react';
import { useToast } from "@/components/ui/use-toast";
import { TeddyCard } from '../../types/types';
import { calculateDamage } from '../../utils/battleUtils';
import PlayerStats from './PlayerStats';
import BattleActions from './BattleActions';
import BattleLogDisplay from './BattleLogDisplay';

interface BattleSystemProps {
  playerTeddy: TeddyCard;
  opponentTeddy: TeddyCard;
  onBattleEnd: (winner: 'player' | 'opponent') => void;
}

const BattleSystem = ({ playerTeddy, opponentTeddy, onBattleEnd }: BattleSystemProps) => {
  const [playerHealth, setPlayerHealth] = useState(100);
  const [opponentHealth, setOpponentHealth] = useState(100);
  const [playerEnergy, setPlayerEnergy] = useState(3);
  const [opponentEnergy, setOpponentEnergy] = useState(3);
  const [isPlayerTurn, setIsPlayerTurn] = useState(true);
  const [battleLog, setBattleLog] = useState<string[]>([]);
  const [isAnimating, setIsAnimating] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (playerHealth <= 0) {
      onBattleEnd('opponent');
    } else if (opponentHealth <= 0) {
      onBattleEnd('player');
    }
  }, [playerHealth, opponentHealth, onBattleEnd]);

  const addToBattleLog = (message: string) => {
    setBattleLog(prev => [...prev, message]);
  };

  const performAction = async (action: 'attack' | 'defend' | 'special') => {
    if (!isPlayerTurn || isAnimating) return;
    setIsAnimating(true);

    let damage = 0;
    let energyCost = 1;

    switch (action) {
      case 'attack':
        damage = calculateDamage(playerTeddy, opponentTeddy);
        addToBattleLog(`${playerTeddy.name} attacks for ${damage} damage!`);
        setOpponentHealth(prev => Math.max(0, prev - damage));
        break;
      case 'defend':
        addToBattleLog(`${playerTeddy.name} takes a defensive stance!`);
        setPlayerHealth(prev => Math.min(100, prev + 10));
        break;
      case 'special':
        if (playerEnergy < 2) {
          toast({
            title: "Not enough energy!",
            description: "Special moves require 2 energy points.",
            variant: "destructive",
          });
          setIsAnimating(false);
          return;
        }
        energyCost = 2;
        damage = calculateDamage(playerTeddy, opponentTeddy) * 1.5;
        addToBattleLog(`${playerTeddy.name} uses ${playerTeddy.specialMove} for ${damage} damage!`);
        setOpponentHealth(prev => Math.max(0, prev - damage));
        break;
    }

    setPlayerEnergy(prev => Math.max(0, prev - energyCost));
    await new Promise(resolve => setTimeout(resolve, 1000));
    setIsAnimating(false);
    setIsPlayerTurn(false);
    setTimeout(performOpponentTurn, 1500);
  };

  const performOpponentTurn = () => {
    const actions = ['attack', 'defend', 'special'];
    const randomAction = actions[Math.floor(Math.random() * actions.length)];
    let damage = 0;

    switch (randomAction) {
      case 'attack':
        damage = calculateDamage(opponentTeddy, playerTeddy);
        addToBattleLog(`${opponentTeddy.name} attacks for ${damage} damage!`);
        setPlayerHealth(prev => Math.max(0, prev - damage));
        break;
      case 'defend':
        addToBattleLog(`${opponentTeddy.name} takes a defensive stance!`);
        setOpponentHealth(prev => Math.min(100, prev + 10));
        break;
      case 'special':
        if (opponentEnergy >= 2) {
          damage = calculateDamage(opponentTeddy, playerTeddy) * 1.5;
          addToBattleLog(`${opponentTeddy.name} uses ${opponentTeddy.specialMove} for ${damage} damage!`);
          setPlayerHealth(prev => Math.max(0, prev - damage));
          setOpponentEnergy(prev => prev - 2);
        } else {
          damage = calculateDamage(opponentTeddy, playerTeddy);
          addToBattleLog(`${opponentTeddy.name} attacks for ${damage} damage!`);
          setPlayerHealth(prev => Math.max(0, prev - damage));
        }
        break;
    }

    setOpponentEnergy(prev => Math.min(3, prev + 1));
    setPlayerEnergy(prev => Math.min(3, prev + 1));
    setIsPlayerTurn(true);
  };

  return (
    <div className="w-full max-w-4xl mx-auto p-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <PlayerStats
          teddy={playerTeddy}
          health={playerHealth}
          energy={playerEnergy}
        />
        <PlayerStats
          teddy={opponentTeddy}
          health={opponentHealth}
          energy={opponentEnergy}
          isOpponent
        />
      </div>

      <BattleActions
        onAction={performAction}
        isPlayerTurn={isPlayerTurn}
        isAnimating={isAnimating}
        playerEnergy={playerEnergy}
      />

      <BattleLogDisplay logs={battleLog} />
    </div>
  );
};

export default BattleSystem;