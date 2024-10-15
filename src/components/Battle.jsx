import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { motion } from 'framer-motion';
import { calculateDamage } from '../utils/battleSystem';

const Battle = ({ playerTeddy, opponentTeddy, onBattleEnd }) => {
  const [playerHealth, setPlayerHealth] = useState(100);
  const [opponentHealth, setOpponentHealth] = useState(100);
  const [currentTurn, setCurrentTurn] = useState('player');
  const [battleLog, setBattleLog] = useState([]);
  const { toast } = useToast();

  useEffect(() => {
    if (playerHealth <= 0) {
      onBattleEnd('lose');
    } else if (opponentHealth <= 0) {
      onBattleEnd('win');
    }
  }, [playerHealth, opponentHealth, onBattleEnd]);

  const addToBattleLog = (message) => {
    setBattleLog(prevLog => [...prevLog, message]);
  };

  const handlePlayerAction = (action) => {
    if (currentTurn !== 'player') return;

    let damage = 0;
    switch (action) {
      case 'attack':
        damage = calculateDamage(playerTeddy, opponentTeddy);
        setOpponentHealth(prev => Math.max(0, prev - damage));
        addToBattleLog(`${playerTeddy.name} attacks for ${damage} damage!`);
        break;
      case 'defend':
        addToBattleLog(`${playerTeddy.name} takes a defensive stance.`);
        break;
      case 'special':
        damage = calculateDamage(playerTeddy, opponentTeddy) * 1.5;
        setOpponentHealth(prev => Math.max(0, prev - damage));
        addToBattleLog(`${playerTeddy.name} uses ${playerTeddy.special_move} for ${damage} damage!`);
        break;
      default:
        break;
    }

    setCurrentTurn('opponent');
    setTimeout(handleOpponentTurn, 1500);
  };

  const handleOpponentTurn = () => {
    const actions = ['attack', 'defend', 'special'];
    const randomAction = actions[Math.floor(Math.random() * actions.length)];
    let damage = 0;

    switch (randomAction) {
      case 'attack':
        damage = calculateDamage(opponentTeddy, playerTeddy);
        setPlayerHealth(prev => Math.max(0, prev - damage));
        addToBattleLog(`${opponentTeddy.name} attacks for ${damage} damage!`);
        break;
      case 'defend':
        addToBattleLog(`${opponentTeddy.name} takes a defensive stance.`);
        break;
      case 'special':
        damage = calculateDamage(opponentTeddy, playerTeddy) * 1.5;
        setPlayerHealth(prev => Math.max(0, prev - damage));
        addToBattleLog(`${opponentTeddy.name} uses ${opponentTeddy.special_move} for ${damage} damage!`);
        break;
      default:
        break;
    }

    setCurrentTurn('player');
  };

  const renderTeddyCard = (teddy, health) => (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle>{teddy.name}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-gray-600">{teddy.title}</p>
        <Progress value={health} className="mt-2" />
        <p className="mt-2">Health: {health}</p>
        <p>Attack: {teddy.attack}</p>
        <p>Defense: {teddy.defense}</p>
        <p>Special: {teddy.special_move}</p>
      </CardContent>
    </Card>
  );

  return (
    <div className="battle-arena">
      <h2 className="text-2xl font-bold mb-4">Battle Arena</h2>
      <div className="flex justify-between mb-4">
        {renderTeddyCard(playerTeddy, playerHealth)}
        {renderTeddyCard(opponentTeddy, opponentHealth)}
      </div>
      <div className="mb-4">
        <h3 className="text-xl font-semibold mb-2">Battle Log</h3>
        <div className="h-40 overflow-y-auto bg-gray-100 p-2 rounded">
          {battleLog.map((log, index) => (
            <p key={index}>{log}</p>
          ))}
        </div>
      </div>
      <div className="flex justify-center space-x-4">
        <Button onClick={() => handlePlayerAction('attack')} disabled={currentTurn !== 'player'}>
          Attack
        </Button>
        <Button onClick={() => handlePlayerAction('defend')} disabled={currentTurn !== 'player'}>
          Defend
        </Button>
        <Button onClick={() => handlePlayerAction('special')} disabled={currentTurn !== 'player'}>
          Special
        </Button>
      </div>
    </div>
  );
};

export default Battle;