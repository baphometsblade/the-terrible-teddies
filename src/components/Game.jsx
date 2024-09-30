import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import TeddyCard from './TeddyCard';
import PlayerHand from './PlayerHand';
import BattleArena from './BattleArena';

const Game = () => {
  const [playerDeck, setPlayerDeck] = useState([]);
  const [opponentDeck, setOpponentDeck] = useState([]);
  const [playerHand, setPlayerHand] = useState([]);
  const [selectedCard, setSelectedCard] = useState(null);

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

  if (isLoading) return <div>Loading game...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-4">Terrible Teddies</h1>
      <BattleArena selectedCard={selectedCard} opponentDeck={opponentDeck} />
      <PlayerHand hand={playerHand} onCardSelect={handleCardSelect} />
    </div>
  );
};

export default Game;