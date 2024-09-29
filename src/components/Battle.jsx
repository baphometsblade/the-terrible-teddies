import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { Button } from "@/components/ui/button";
import TeddyCard from './TeddyCard';
import { calculateDamage } from '../utils/gameLogic';
import AIOpponent from '../utils/AIOpponent';
import { useToast } from "@/components/ui/use-toast";
import { motion } from 'framer-motion';

const Battle = () => {
  const [playerTeddy, setPlayerTeddy] = useState(null);
  const [opponentTeddy, setOpponentTeddy] = useState(null);
  const [playerHealth, setPlayerHealth] = useState(30);
  const [opponentHealth, setOpponentHealth] = useState(30);
  const [currentTurn, setCurrentTurn] = useState('player');
  const [playerEnergy, setPlayerEnergy] = useState(3);
  const [opponentEnergy, setOpponentEnergy] = useState(3);
  const [battleLog, setBattleLog] = useState([]);
  const [isGameOver, setIsGameOver] = useState(false);
  const { toast } = useToast();

  const { data: playerTeddies, isLoading, error } = useQuery({
    queryKey: ['playerTeddies'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('player_teddies')
        .select('terrible_teddies(*)')
        .limit(5);
      if (error) throw error;
      return data.map(item => item.terrible_teddies);
    },
  });

  useEffect(() => {
    if (playerTeddies && playerTeddies.length > 0) {
      setPlayerTeddy(playerTeddies[0]);
      setOpponentTeddy(AIOpponent.generateTeddy());
    }
  }, [playerTeddies]);

  const handleAttack = () => {
    if (currentTurn === 'player' && !isGameOver) {
      const damage = calculateDamage(playerTeddy, opponentTeddy);
      setOpponentHealth(prev => Math.max(0, prev - damage));
      addToBattleLog(`${playerTeddy.name} attacks for ${damage} damage!`);
      checkGameOver();
      endTurn();
    }
  };

  const handleDefend = () => {
    if (currentTurn === 'player' && !isGameOver) {
      setPlayerTeddy(prev => ({ ...prev, defense: prev.defense + 2 }));
      addToBattleLog(`${playerTeddy.name} increases defense by 2!`);
      endTurn();
    }
  };

  const handleSpecialMove = () => {
    if (currentTurn === 'player' && playerEnergy >= 2 && !isGameOver) {
      setPlayerEnergy(prev => prev - 2);
      // Implement special move logic here
      addToBattleLog(`${playerTeddy.name} uses ${playerTeddy.specialMove}!`);
      endTurn();
    }
  };

  const endTurn = () => {
    setCurrentTurn('opponent');
    setTimeout(opponentTurn, 1000);
  };

  const opponentTurn = () => {
    if (isGameOver) return;
    const action = AIOpponent.chooseAction(opponentTeddy, playerTeddy, opponentEnergy);
    switch (action) {
      case 'attack':
        const damage = calculateDamage(opponentTeddy, playerTeddy);
        setPlayerHealth(prev => Math.max(0, prev - damage));
        addToBattleLog(`${opponentTeddy.name} attacks for ${damage} damage!`);
        break;
      case 'defend':
        setOpponentTeddy(prev => ({ ...prev, defense: prev.defense + 2 }));
        addToBattleLog(`${opponentTeddy.name} increases defense by 2!`);
        break;
      case 'special':
        setOpponentEnergy(prev => prev - 2);
        // Implement opponent special move logic here
        addToBattleLog(`${opponentTeddy.name} uses ${opponentTeddy.specialMove}!`);
        break;
    }
    checkGameOver();
    setCurrentTurn('player');
  };

  const addToBattleLog = (message) => {
    setBattleLog(prev => [...prev, message]);
  };

  const checkGameOver = () => {
    if (playerHealth <= 0 || opponentHealth <= 0) {
      setIsGameOver(true);
      const winner = playerHealth > 0 ? 'Player' : 'Opponent';
      toast({
        title: "Game Over",
        description: `${winner} wins the battle!`,
        variant: winner === 'Player' ? "success" : "destructive",
      });
    }
  };

  if (isLoading) return <div>Loading battle...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-4">Battle Arena</h1>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <h2 className="text-2xl font-bold mb-2">Your Teddy</h2>
          {playerTeddy && <TeddyCard teddy={playerTeddy} />}
          <motion.div
            className="mt-2 p-2 bg-blue-100 rounded"
            animate={{ scale: playerHealth <= 10 ? [1, 1.1, 1] : 1 }}
            transition={{ repeat: Infinity, duration: 0.5 }}
          >
            <p>Health: {playerHealth}</p>
            <p>Energy: {playerEnergy}</p>
          </motion.div>
        </div>
        <div>
          <h2 className="text-2xl font-bold mb-2">Opponent's Teddy</h2>
          {opponentTeddy && <TeddyCard teddy={opponentTeddy} />}
          <motion.div
            className="mt-2 p-2 bg-red-100 rounded"
            animate={{ scale: opponentHealth <= 10 ? [1, 1.1, 1] : 1 }}
            transition={{ repeat: Infinity, duration: 0.5 }}
          >
            <p>Health: {opponentHealth}</p>
            <p>Energy: {opponentEnergy}</p>
          </motion.div>
        </div>
      </div>
      <div className="mt-4">
        <Button onClick={handleAttack} disabled={currentTurn !== 'player' || isGameOver} className="mr-2">Attack</Button>
        <Button onClick={handleDefend} disabled={currentTurn !== 'player' || isGameOver} className="mr-2">Defend</Button>
        <Button onClick={handleSpecialMove} disabled={currentTurn !== 'player' || playerEnergy < 2 || isGameOver}>Special Move</Button>
      </div>
      <div className="mt-4">
        <h3 className="text-xl font-bold mb-2">Battle Log</h3>
        <ul className="list-disc list-inside h-40 overflow-y-auto bg-gray-100 p-4 rounded">
          {battleLog.map((log, index) => (
            <motion.li
              key={index}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              {log}
            </motion.li>
          ))}
        </ul>
      </div>
    </div>
  );
};

export default Battle;