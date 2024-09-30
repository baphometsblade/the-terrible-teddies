import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import TeddyCard from './TeddyCard';
import PlayerHand from './PlayerHand';
import Battle from './Battle/Battle';
import Shop from './Shop';
import PlayerProfile from './PlayerProfile';
import DailyChallenge from './DailyChallenge';
import DeckBuilder from './DeckBuilder/DeckBuilder';
import Leaderboard from './Leaderboard';
import PlayerSubmission from './PlayerSubmission';
import BearEvolution from './BearEvolution';
import { Button } from "@/components/ui/button";

const Game = () => {
  const [playerDeck, setPlayerDeck] = useState([]);
  const [opponentDeck, setOpponentDeck] = useState([]);
  const [playerHand, setPlayerHand] = useState([]);
  const [selectedCard, setSelectedCard] = useState(null);
  const [gameState, setGameState] = useState('menu'); // 'menu', 'battle', 'shop', 'profile', 'challenge', 'deckBuilder', 'leaderboard', 'submission', 'evolution'

  const { data: teddies, isLoading, error } = useQuery({
    queryKey: ['teddies'],
    queryFn: async () => {
      const { data, error } = await supabase.from('terrible_teddies').select('*');
      if (error) throw error;
      return data;
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
    // Handle battle result (e.g., update player stats, give rewards)
    setGameState('menu');
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
      case 'profile':
        return <PlayerProfile />;
      case 'challenge':
        return <DailyChallenge />;
      case 'deckBuilder':
        return <DeckBuilder />;
      case 'leaderboard':
        return <Leaderboard />;
      case 'submission':
        return <PlayerSubmission />;
      case 'evolution':
        return <BearEvolution teddy={selectedCard} onEvolve={(evolvedTeddy) => {
          // Update the player's teddy in the state or refetch the player's teddies
          setGameState('menu');
        }} />;
      default:
        return (
          <div className="flex flex-col space-y-4">
            <Button onClick={() => setGameState('battle')}>Start Battle</Button>
            <Button onClick={() => setGameState('shop')}>Visit Shop</Button>
            <Button onClick={() => setGameState('profile')}>View Profile</Button>
            <Button onClick={() => setGameState('challenge')}>Daily Challenge</Button>
            <Button onClick={() => setGameState('deckBuilder')}>Deck Builder</Button>
            <Button onClick={() => setGameState('leaderboard')}>Leaderboard</Button>
            <Button onClick={() => setGameState('submission')}>Submit Teddy Idea</Button>
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
      {gameState !== 'battle' && gameState !== 'deckBuilder' && (
        <PlayerHand hand={playerHand} onCardSelect={handleCardSelect} />
      )}
      {renderGameContent()}
    </div>
  );
};

export default Game;