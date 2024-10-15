import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { motion, AnimatePresence } from 'framer-motion';
import { Sword, Shield, Zap } from 'lucide-react';
import { calculateDamage, calculateExperience, levelUp } from '../utils/battleSystem';

const Battle = ({ playerTeddy, opponentTeddy, onBattleEnd }) => {
  const [playerHealth, setPlayerHealth] = useState(100);
  const [opponentHealth, setOpponentHealth] = useState(100);
  const [currentTurn, setCurrentTurn] = useState('player');
  const [battleLog, setBattleLog] = useState([]);
  const [playerEnergy, setPlayerEnergy] = useState(3);
  const [opponentEnergy, setOpponentEnergy] = useState(3);
  const [animation, setAnimation] = useState(null);
  const { toast } = useToast();

  useEffect(() => {
    if (playerHealth <= 0) {
      onBattleEnd('lose');
    } else if (opponentHealth <= 0) {
      const experience = calculateExperience(playerTeddy, opponentTeddy);
      const updatedTeddy = levelUp(playerTeddy, experience);
      onBattleEnd('win', updatedTeddy, experience);
    }
  }, [playerHealth, opponentHealth, onBattleEnd, playerTeddy, opponentTeddy]);

  const addToBattleLog = (message) => {
    setBattleLog(prevLog => [...prevLog, message]);
  };

  const handlePlayerAction = (action) => {
    if (currentTurn !== 'player') return;

    let damage = 0;
    let energyCost = 1;

    switch (action) {
      case 'attack':
        damage = calculateDamage(playerTeddy, opponentTeddy);
        setOpponentHealth(prev => Math.max(0, prev - damage));
        addToBattleLog(`${playerTeddy.name} attacks for ${damage} damage!`);
        break;
      case 'defend':
        playerTeddy.defense += 2;
        addToBattleLog(`${playerTeddy.name} takes a defensive stance, increasing defense by 2.`);
        break;
      case 'special':
        if (playerEnergy >= 2) {
          damage = calculateDamage(playerTeddy, opponentTeddy) * 1.5;
          setOpponentHealth(prev => Math.max(0, prev - damage));
          addToBattleLog(`${playerTeddy.name} uses ${playerTeddy.special_move} for ${damage} damage!`);
          energyCost = 2;
        } else {
          addToBattleLog(`Not enough energy for special move!`);
          return;
        }
        break;
      default:
        break;
    }

    setPlayerEnergy(prev => Math.max(0, prev - energyCost));
    setAnimation(action);
    setTimeout(() => setAnimation(null), 500);
    setCurrentTurn('opponent');
    setTimeout(handleOpponentTurn, 1500);
  };

  const handleOpponentTurn = () => {
    const actions = ['attack', 'defend', 'special'];
    const randomAction = actions[Math.floor(Math.random() * actions.length)];
    let damage = 0;
    let energyCost = 1;

    switch (randomAction) {
      case 'attack':
        damage = calculateDamage(opponentTeddy, playerTeddy);
        setPlayerHealth(prev => Math.max(0, prev - damage));
        addToBattleLog(`${opponentTeddy.name} attacks for ${damage} damage!`);
        break;
      case 'defend':
        opponentTeddy.defense += 2;
        addToBattleLog(`${opponentTeddy.name} takes a defensive stance, increasing defense by 2.`);
        break;
      case 'special':
        if (opponentEnergy >= 2) {
          damage = calculateDamage(opponentTeddy, playerTeddy) * 1.5;
          setPlayerHealth(prev => Math.max(0, prev - damage));
          addToBattleLog(`${opponentTeddy.name} uses ${opponentTeddy.special_move} for ${damage} damage!`);
          energyCost = 2;
        } else {
          addToBattleLog(`${opponentTeddy.name} tried to use a special move but didn't have enough energy!`);
          return handleOpponentTurn();
        }
        break;
      default:
        break;
    }

    setOpponentEnergy(prev => Math.max(0, prev - energyCost));
    setAnimation(randomAction);
    setTimeout(() => setAnimation(null), 500);
    setCurrentTurn('player');
  };

  const renderTeddyCard = (teddy, health, energy) => (
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
        <p>Energy: {energy}</p>
      </CardContent>
    </Card>
  );

  return (
    <div className="battle-arena">
      <h2 className="text-2xl font-bold mb-4">Battle Arena</h2>
      <div className="flex justify-between mb-4">
        {renderTeddyCard(playerTeddy, playerHealth, playerEnergy)}
        {renderTeddyCard(opponentTeddy, opponentHealth, opponentEnergy)}
      </div>
      <AnimatePresence>
        {animation && (
          <motion.div
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.5 }}
            className="text-center text-2xl font-bold mb-4"
          >
            {animation === 'attack' && <Sword className="inline-block w-12 h-12 text-red-500" />}
            {animation === 'defend' && <Shield className="inline-block w-12 h-12 text-blue-500" />}
            {animation === 'special' && <Zap className="inline-block w-12 h-12 text-yellow-500" />}
          </motion.div>
        )}
      </AnimatePresence>
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
        <Button onClick={() => handlePlayerAction('special')} disabled={currentTurn !== 'player' || playerEnergy < 2}>
          Special
        </Button>
      </div>
    </div>
  );
};

export default Battle;