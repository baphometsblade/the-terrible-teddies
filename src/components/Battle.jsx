import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { Button } from "@/components/ui/button";
import TeddyCard from './TeddyCard';
import { calculateDamage } from '../utils/gameLogic';
import AIOpponent from '../utils/AIOpponent';
import { useToast } from "@/components/ui/use-toast";

const Battle = () => {
  const [playerTeddy, setPlayerTeddy] = useState(null);
  const [opponentTeddy, setOpponentTeddy] = useState(null);
  const [playerHealth, setPlayerHealth] = useState(30);
  const [opponentHealth, setOpponentHealth] = useState(30);
  const [currentTurn, setCurrentTurn] = useState('player');
  const [playerEnergy, setPlayerEnergy] = useState(3);
  const [opponentEnergy, setOpponentEnergy] = useState(3);
  const [battleLog, setBattleLog] = useState([]);
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
    if (currentTurn === 'player') {
      const damage = calculateDamage(playerTeddy, opponentTeddy);
      setOpponentHealth(prev => Math.max(0, prev - damage));
      addToBattleLog(`${playerTeddy.name} attacks for ${damage} damage!`);
      endTurn();
    }
  };

  const handleDefend = () => {
    if (currentTurn === 'player') {
      setPlayerTeddy(prev => ({ ...prev, defense: prev.defense + 2 }));
      addToBattleLog(`${playerTeddy.name} increases defense by 2!`);
      endTurn();
    }
  };

  const handleSpecialMove = () => {
    if (currentTurn === 'player' && playerEnergy >= 2) {
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
    setCurrentTurn('player');
  };

  const addToBattleLog = (message) => {
    setBattleLog(prev => [...prev, message]);
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
          <p>Health: {playerHealth}</p>
          <p>Energy: {playerEnergy}</p>
        </div>
        <div>
          <h2 className="text-2xl font-bold mb-2">Opponent's Teddy</h2>
          {opponentTeddy && <TeddyCard teddy={opponentTeddy} />}
          <p>Health: {opponentHealth}</p>
          <p>Energy: {opponentEnergy}</p>
        </div>
      </div>
      <div className="mt-4">
        <Button onClick={handleAttack} disabled={currentTurn !== 'player'} className="mr-2">Attack</Button>
        <Button onClick={handleDefend} disabled={currentTurn !== 'player'} className="mr-2">Defend</Button>
        <Button onClick={handleSpecialMove} disabled={currentTurn !== 'player' || playerEnergy < 2}>Special Move</Button>
      </div>
      <div className="mt-4">
        <h3 className="text-xl font-bold mb-2">Battle Log</h3>
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