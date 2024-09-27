import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import TeddyCard from './TeddyCard';
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";

const fetchPlayerDeck = async () => {
  const { data, error } = await supabase
    .from('player_decks')
    .select('deck')
    .single();
  if (error) throw error;
  return data.deck;
};

const fetchTeddies = async (ids) => {
  const { data, error } = await supabase
    .from('terrible_teddies')
    .select('*')
    .in('id', ids);
  if (error) throw error;
  return data;
};

const GameBoard = () => {
  const [playerHand, setPlayerHand] = useState([]);
  const [opponentHand, setOpponentHand] = useState([]);
  const [selectedTeddy, setSelectedTeddy] = useState(null);
  const [opponentTeddy, setOpponentTeddy] = useState(null);
  const [gameState, setGameState] = useState('drawing'); // 'drawing', 'battling', 'gameOver'
  const { toast } = useToast();

  const { data: playerDeckIds, isLoading: isDeckLoading, error: deckError } = useQuery({
    queryKey: ['playerDeck'],
    queryFn: fetchPlayerDeck,
  });

  const { data: playerDeck, isLoading: isTeddiesLoading, error: teddiesError } = useQuery({
    queryKey: ['playerTeddies', playerDeckIds],
    queryFn: () => fetchTeddies(playerDeckIds),
    enabled: !!playerDeckIds,
  });

  useEffect(() => {
    if (playerDeck) {
      const shuffledDeck = [...playerDeck].sort(() => Math.random() - 0.5);
      setPlayerHand(shuffledDeck.slice(0, 5));
      setOpponentHand(shuffledDeck.slice(5, 10)); // Simplified opponent hand
    }
  }, [playerDeck]);

  const selectTeddy = (teddy) => {
    setSelectedTeddy(teddy);
  };

  const startBattle = () => {
    if (!selectedTeddy) {
      toast({
        title: "Select a teddy",
        description: "You must select a teddy to battle",
        variant: "destructive",
      });
      return;
    }
    setOpponentTeddy(opponentHand[Math.floor(Math.random() * opponentHand.length)]);
    setGameState('battling');
  };

  const calculateDamage = (attacker, defender) => {
    return Math.max(0, attacker.attack - defender.defense);
  };

  const resolveBattle = () => {
    const playerDamage = calculateDamage(selectedTeddy, opponentTeddy);
    const opponentDamage = calculateDamage(opponentTeddy, selectedTeddy);

    if (playerDamage > opponentDamage) {
      toast({
        title: "Victory!",
        description: `${selectedTeddy.name} defeats ${opponentTeddy.name}!`,
        variant: "success",
      });
    } else if (opponentDamage > playerDamage) {
      toast({
        title: "Defeat!",
        description: `${opponentTeddy.name} defeats ${selectedTeddy.name}!`,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Draw!",
        description: "The battle ends in a draw!",
      });
    }

    setGameState('drawing');
    setSelectedTeddy(null);
    setOpponentTeddy(null);
  };

  if (isDeckLoading || isTeddiesLoading) return <div>Loading game...</div>;
  if (deckError || teddiesError) return <div>Error: {deckError?.message || teddiesError?.message}</div>;

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-4">Battle Arena</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <h2 className="text-2xl font-bold mb-2">Your Hand</h2>
          <div className="grid grid-cols-2 gap-2">
            {playerHand.map(teddy => (
              <TeddyCard 
                key={teddy.id} 
                teddy={teddy} 
                onClick={() => selectTeddy(teddy)}
                selected={selectedTeddy?.id === teddy.id}
              />
            ))}
          </div>
        </div>
        <div>
          <h2 className="text-2xl font-bold mb-2">Opponent's Hand</h2>
          <div className="grid grid-cols-2 gap-2">
            {opponentHand.map(teddy => (
              <TeddyCard key={teddy.id} teddy={teddy} faceDown={gameState !== 'battling'} />
            ))}
          </div>
        </div>
      </div>
      {gameState === 'drawing' && (
        <Button onClick={startBattle} className="mt-4" disabled={!selectedTeddy}>Start Battle</Button>
      )}
      {gameState === 'battling' && (
        <div className="mt-4">
          <h2 className="text-2xl font-bold mb-2">Battle</h2>
          <div className="flex justify-around">
            <TeddyCard teddy={selectedTeddy} />
            <div className="flex items-center">VS</div>
            <TeddyCard teddy={opponentTeddy} />
          </div>
          <Button onClick={resolveBattle} className="mt-4">Resolve Battle</Button>
        </div>
      )}
    </div>
  );
};

export default GameBoard;