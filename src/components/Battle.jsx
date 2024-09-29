import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { Button } from "@/components/ui/button";
import TeddyCard from './TeddyCard';
import { calculateDamage } from '../utils/battleSystem';

const Battle = () => {
  const [playerTeddy, setPlayerTeddy] = useState(null);
  const [opponentTeddy, setOpponentTeddy] = useState(null);
  const [playerHealth, setPlayerHealth] = useState(30);
  const [opponentHealth, setOpponentHealth] = useState(30);
  const [currentTurn, setCurrentTurn] = useState('player');

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
      setOpponentTeddy(generateOpponentTeddy());
    }
  }, [playerTeddies]);

  const generateOpponentTeddy = () => {
    // This is a placeholder. In a real game, you'd fetch this from the server or generate it dynamically.
    return {
      name: "Evil McFluffles",
      attack: 5,
      defense: 5,
      specialMove: "Fluff Explosion"
    };
  };

  const handleAttack = () => {
    if (currentTurn === 'player') {
      const damage = calculateDamage(playerTeddy, opponentTeddy);
      setOpponentHealth(prev => Math.max(0, prev - damage));
      setCurrentTurn('opponent');
      setTimeout(opponentTurn, 1000);
    }
  };

  const opponentTurn = () => {
    const damage = calculateDamage(opponentTeddy, playerTeddy);
    setPlayerHealth(prev => Math.max(0, prev - damage));
    setCurrentTurn('player');
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
        </div>
        <div>
          <h2 className="text-2xl font-bold mb-2">Opponent's Teddy</h2>
          {opponentTeddy && <TeddyCard teddy={opponentTeddy} />}
          <p>Health: {opponentHealth}</p>
        </div>
      </div>
      <div className="mt-4">
        <Button onClick={handleAttack} disabled={currentTurn !== 'player'}>Attack</Button>
      </div>
    </div>
  );
};

export default Battle;