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
import { captureEvent } from '../utils/posthog';

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
      console.log('Fetching teddies');
      const { data, error } = await supabase.from('terrible_teddies').select('*');
      if (error) {
        console.error('Error fetching teddies:', error);
        throw error;
      }
      console.log('Fetched teddies:', data);
      return data;
    },
    onError: (error) => {
      console.error('Query error:', error);
      toast({
        title: "Error fetching teddies",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  useEffect(() => {
    if (teddies) {
      console.log('Setting up decks and hands');
      const shuffledTeddies = [...teddies].sort(() => Math.random() - 0.5);
      setPlayerDeck(shuffledTeddies.slice(0, 10));
      setOpponentDeck(shuffledTeddies.slice(10, 20));
      setPlayerHand(shuffledTeddies.slice(0, 5));
    }
  }, [teddies]);

  const handleCardSelect = (card) => {
    console.log('Card selected:', card);
    setSelectedCard(card);
    captureEvent('Card_Selected', { cardId: card.id });
  };

  const handleBattleEnd = (result) => {
    console.log('Battle ended:', result);
    setGameState('menu');
    captureEvent('Battle_Ended', { result });
    // Here you could add logic to update player stats, give rewards, etc.
  };

  const renderGameContent = () => {
    console.log('Rendering game content for state:', gameState);
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
          console.log('Teddy evolved:', evolvedTeddy);
          captureEvent('Teddy_Evolved', { teddyId: evolvedTeddy.id });
          setGameState('menu');
        }} />;
      default:
        return (
          <div className="flex flex-col space-y-4">
            <Button onClick={() => {
              setGameState('battle');
              captureEvent('Battle_Started');
            }}>Start Battle</Button>
            <Button onClick={() => {
              setGameState('shop');
              captureEvent('Shop_Opened');
            }}>Visit Shop</Button>
            <Button onClick={() => {
              setGameState('challenge');
              captureEvent('Daily_Challenge_Started');
            }}>Daily Challenge</Button>
            <Button onClick={() => {
              setGameState('evolution');
              captureEvent('Evolution_Started');
            }} disabled={!selectedCard}>Evolve Teddy</Button>
          </div>
        );
    }
  };

  if (isLoading) {
    console.log('Game is loading');
    return <div>Loading game...</div>;
  }
  if (error) {
    console.error('Game error:', error);
    return <div>Error: {error.message}</div>;
  }

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