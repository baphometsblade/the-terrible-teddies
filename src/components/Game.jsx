import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import TeddyCard from './TeddyCard';
import PlayerHand from './PlayerHand';
import Battle from './Battle/Battle';
import Shop from './Shop';
import DailyChallenge from './DailyChallenge';
import BearEvolution from './BearEvolution';
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";

const Game = () => {
  const [playerDeck, setPlayerDeck] = useState([]);
  const [opponentDeck, setOpponentDeck] = useState([]);
  const [playerHand, setPlayerHand] = useState([]);
  const [selectedCard, setSelectedCard] = useState(null);
  const [gameState, setGameState] = useState('menu');
  const { toast } = useToast();

  const { data: teddies, isLoading, error } = useQuery({
    queryKey: ['teddies'],
    queryFn: async () => {
      const { data, error } = await supabase.from('terrible_teddies').select('*');
      if (error) throw error;
      return data;
    },
    onError: (error) => {
      toast({
        title: "Error fetching teddies",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  useEffect(() => {
    if (teddies) {
      const shuffledTeddies = [...teddies].sort(() => Math.random() - 0.5);
      setPlayerDeck(shuffledTeddies.slice(0, 10));
      setOpponentDeck(shuffledTeddies.slice(10, 20));
      setPlayerHand(shuffledTeddies.slice(0, 5));
    }
  }, [teddies]);

  const handleCardSelect = (card) => {
    setSelectedCard(card);
  };

  const handleBattleEnd = (result) => {
    setGameState('menu');
    // Here you could add logic to update player stats, give rewards, etc.
  };

  const renderGameContent = () => {
    switch (gameState) {
      case 'battle':
        return (
          <Battle
            playerTeddy={selectedCard}
            opponentTeddy={opponentDeck[0]}
            onBattleEnd={handleBattleEnd}
          />
        );
      case 'shop':
        return <Shop />;
      case 'challenge':
        return <DailyChallenge />;
      case 'evolution':
        return <BearEvolution teddy={selectedCard} onEvolve={(evolvedTeddy) => {
          // Here you could update the player's deck with the evolved teddy
          setGameState('menu');
        }} />;
      default:
        return (
          <div className="flex flex-col space-y-4">
            <Button onClick={() => setGameState('battle')}>Start Battle</Button>
            <Button onClick={() => setGameState('shop')}>Visit Shop</Button>
            <Button onClick={() => setGameState('challenge')}>Daily Challenge</Button>
            <Button onClick={() => setGameState('evolution')} disabled={!selectedCard}>Evolve Teddy</Button>
          </div>
        );
    }
  };

  if (isLoading) return <div>Loading game...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-4">Terrible Teddies</h1>
      {gameState !== 'battle' && (
        <PlayerHand hand={playerHand} onCardSelect={handleCardSelect} />
      )}
      {renderGameContent()}
    </div>
  );
};

export default Game;