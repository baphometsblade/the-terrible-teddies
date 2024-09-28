import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import TeddyCard from './TeddyCard';
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";

const fetchPlayerDeck = async () => {
  const { data, error } = await supabase
    .from('player_decks')
    .select('*')
    .single();
  if (error) throw error;
  return data.deck;
};

const BattleArena = () => {
  const [playerTeddy, setPlayerTeddy] = useState(null);
  const [opponentTeddy, setOpponentTeddy] = useState(null);
  const [playerHealth, setPlayerHealth] = useState(30);
  const [opponentHealth, setOpponentHealth] = useState(30);
  const [currentTurn, setCurrentTurn] = useState('player');
  const { toast } = useToast();

  const { data: playerDeck, isLoading, error } = useQuery({
    queryKey: ['playerDeck'],
    queryFn: fetchPlayerDeck,
  });

  useEffect(() => {
    if (playerDeck) {
      setPlayerTeddy(playerDeck[Math.floor(Math.random() * playerDeck.length)]);
      setOpponentTeddy(playerDeck[Math.floor(Math.random() * playerDeck.length)]);
    }
  }, [playerDeck]);

  const attack = (attacker, defender, setDefenderHealth) => {
    const damage = Math.max(0, attacker.attack - defender.defense);
    setDefenderHealth(prev => Math.max(0, prev - damage));
    return damage;
  };

  const handlePlayerAttack = () => {
    if (currentTurn !== 'player') return;
    const damage = attack(playerTeddy, opponentTeddy, setOpponentHealth);
    toast({
      title: "Attack!",
      description: `${playerTeddy.name} deals ${damage} damage to ${opponentTeddy.name}!`,
    });
    setCurrentTurn('opponent');
    setTimeout(handleOpponentAttack, 1000);
  };

  const handleOpponentAttack = () => {
    const damage = attack(opponentTeddy, playerTeddy, setPlayerHealth);
    toast({
      title: "Opponent Attacks!",
      description: `${opponentTeddy.name} deals ${damage} damage to ${playerTeddy.name}!`,
    });
    setCurrentTurn('player');
  };

  useEffect(() => {
    if (playerHealth <= 0) {
      toast({
        title: "Game Over",
        description: "You lost the battle!",
        variant: "destructive",
      });
    } else if (opponentHealth <= 0) {
      toast({
        title: "Victory!",
        description: "You won the battle!",
        variant: "success",
      });
    }
  }, [playerHealth, opponentHealth, toast]);

  if (isLoading) return <div>Loading battle...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-4 text-center">Battle Arena</h1>
      <div className="flex justify-between mb-8">
        <div className="w-1/2 pr-4">
          <h2 className="text-xl font-bold mb-2">Your Teddy</h2>
          {playerTeddy && <TeddyCard teddy={playerTeddy} />}
          <p className="mt-2">Health: {playerHealth}/30</p>
        </div>
        <div className="w-1/2 pl-4">
          <h2 className="text-xl font-bold mb-2">Opponent's Teddy</h2>
          {opponentTeddy && <TeddyCard teddy={opponentTeddy} />}
          <p className="mt-2">Health: {opponentHealth}/30</p>
        </div>
      </div>
      <div className="text-center">
        <Button 
          onClick={handlePlayerAttack} 
          disabled={currentTurn !== 'player' || playerHealth <= 0 || opponentHealth <= 0}
          className="bg-red-500 hover:bg-red-600 text-white font-bold py-2 px-4 rounded"
        >
          Attack!
        </Button>
      </div>
    </div>
  );
};

export default BattleArena;