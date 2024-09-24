import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';

const fetchCards = async () => {
  const { data, error } = await supabase.from('generated_images').select('*');
  if (error) throw error;
  return data;
};

export const GameBoard = ({ onExit }) => {
  const [playerHand, setPlayerHand] = useState([]);
  const [opponentHand, setOpponentHand] = useState([]);
  const [playerHP, setPlayerHP] = useState(30);
  const [opponentHP, setOpponentHP] = useState(30);

  const { data: cards, isLoading, error } = useQuery({
    queryKey: ['cards'],
    queryFn: fetchCards,
  });

  useEffect(() => {
    if (cards) {
      const shuffledCards = [...cards].sort(() => Math.random() - 0.5);
      setPlayerHand(shuffledCards.slice(0, 5));
      setOpponentHand(shuffledCards.slice(5, 10));
    }
  }, [cards]);

  if (isLoading) return <div>Loading game...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return (
    <div className="game-board">
      <div className="opponent-area mb-8">
        <h2 className="text-2xl font-bold mb-4">Opponent (HP: {opponentHP})</h2>
        <div className="flex space-x-2">
          {opponentHand.map((card) => (
            <div key={card.id} className="w-24 h-32 bg-gray-200 rounded"></div>
          ))}
        </div>
      </div>
      <div className="player-area">
        <h2 className="text-2xl font-bold mb-4">Your Hand (HP: {playerHP})</h2>
        <div className="flex space-x-2">
          {playerHand.map((card) => (
            <div key={card.id} className="w-24 h-32 bg-blue-200 rounded">
              <img src={card.url} alt={card.name} className="w-full h-full object-cover rounded" />
            </div>
          ))}
        </div>
      </div>
      <Button onClick={onExit} className="mt-8">Exit Game</Button>
    </div>
  );
};
