import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../utils/supabaseClient';
import TeddyCard from './TeddyCard';
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { calculateDamage } from '../utils/gameLogic';

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
  const [playerEnergy, setPlayerEnergy] = useState(3);
  const [opponentEnergy, setOpponentEnergy] = useState(3);
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

  const handleAttack = () => {
    if (currentTurn !== 'player') return;
    const damage = calculateDamage(playerTeddy, opponentTeddy);
    setOpponentHealth(prev => Math.max(0, prev - damage));
    toast({
      title: "Attack!",
      description: `${playerTeddy.name} deals ${damage} damage to ${opponentTeddy.name}!`,
    });
    endTurn();
  };

  const handleDefend = () => {
    if (currentTurn !== 'player') return;
    setPlayerTeddy(prev => ({ ...prev, defense: prev.defense + 2 }));
    toast({
      title: "Defend!",
      description: `${playerTeddy.name} increases its defense by 2!`,
    });
    endTurn();
  };

  const handleSpecialMove = () => {
    if (currentTurn !== 'player' || playerEnergy < 2) return;
    setPlayerEnergy(prev => prev - 2);
    // Implement special move logic here
    toast({
      title: "Special Move!",
      description: `${playerTeddy.name} uses ${playerTeddy.specialMove}!`,
    });
    endTurn();
  };

  const endTurn = () => {
    setCurrentTurn('opponent');
    setTimeout(handleOpponentTurn, 1000);
  };

  const handleOpponentTurn = () => {
    const actions = ['attack', 'defend', 'special'];
    const randomAction = actions[Math.floor(Math.random() * actions.length)];

    switch (randomAction) {
      case 'attack':
        const damage = calculateDamage(opponentTeddy, playerTeddy);
        setPlayerHealth(prev => Math.max(0, prev - damage));
        toast({
          title: "Opponent Attacks!",
          description: `${opponentTeddy.name} deals ${damage} damage to ${playerTeddy.name}!`,
        });
        break;
      case 'defend':
        setOpponentTeddy(prev => ({ ...prev, defense: prev.defense + 2 }));
        toast({
          title: "Opponent Defends!",
          description: `${opponentTeddy.name} increases its defense by 2!`,
        });
        break;
      case 'special':
        if (opponentEnergy >= 2) {
          setOpponentEnergy(prev => prev - 2);
          // Implement opponent special move logic here
          toast({
            title: "Opponent Special Move!",
            description: `${opponentTeddy.name} uses ${opponentTeddy.specialMove}!`,
          });
        } else {
          handleOpponentTurn(); // Try again if not enough energy
          return;
        }
        break;
    }

    setCurrentTurn('player');
    setPlayerEnergy(prev => Math.min(prev + 1, 5));
    setOpponentEnergy(prev => Math.min(prev + 1, 5));
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
          <p>Energy: {playerEnergy}/5</p>
        </div>
        <div className="w-1/2 pl-4">
          <h2 className="text-xl font-bold mb-2">Opponent's Teddy</h2>
          {opponentTeddy && <TeddyCard teddy={opponentTeddy} />}
          <p className="mt-2">Health: {opponentHealth}/30</p>
          <p>Energy: {opponentEnergy}/5</p>
        </div>
      </div>
      <div className="text-center">
        <Button 
          onClick={handleAttack} 
          disabled={currentTurn !== 'player' || playerHealth <= 0 || opponentHealth <= 0}
          className="bg-red-500 hover:bg-red-600 text-white font-bold py-2 px-4 rounded mr-2"
        >
          Attack
        </Button>
        <Button 
          onClick={handleDefend} 
          disabled={currentTurn !== 'player' || playerHealth <= 0 || opponentHealth <= 0}
          className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded mr-2"
        >
          Defend
        </Button>
        <Button 
          onClick={handleSpecialMove} 
          disabled={currentTurn !== 'player' || playerEnergy < 2 || playerHealth <= 0 || opponentHealth <= 0}
          className="bg-purple-500 hover:bg-purple-600 text-white font-bold py-2 px-4 rounded"
        >
          Special Move (2 Energy)
        </Button>
      </div>
    </div>
  );
};

export default BattleArena;