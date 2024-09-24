import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import TeddyCard from './TeddyCard';
import { useQuery, useMutation } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';

const fetchCards = async () => {
  const { data, error } = await supabase.from('generated_images').select('*');
  if (error) throw error;
  return data;
};

const saveDeck = async (deck) => {
  const { data, error } = await supabase.from('user_decks').upsert({ deck });
  if (error) throw error;
  return data;
};

export const DeckBuilder = ({ onExit }) => {
  const [deck, setDeck] = useState([]);
  const { data: cards, isLoading, error } = useQuery({
    queryKey: ['cards'],
    queryFn: fetchCards,
  });

  const saveDeckMutation = useMutation({
    mutationFn: saveDeck,
    onSuccess: () => {
      console.log('Deck saved successfully');
    },
  });

  const addToDeck = (card) => {
    if (deck.length < 20) {
      setDeck([...deck, card]);
    }
  };

  const removeFromDeck = (cardId) => {
    setDeck(deck.filter((card) => card.id !== cardId));
  };

  const handleSaveDeck = () => {
    saveDeckMutation.mutate(deck);
  };

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return (
    <div className="deck-builder">
      <h2 className="text-2xl font-bold mb-4">Deck Builder</h2>
      <div className="grid grid-cols-5 gap-4 mb-8">
        {cards.map((card) => (
          <TeddyCard key={card.id} card={card} onClick={() => addToDeck(card)} />
        ))}
      </div>
      <h3 className="text-xl font-bold mb-4">Your Deck ({deck.length}/20)</h3>
      <div className="grid grid-cols-5 gap-4 mb-8">
        {deck.map((card) => (
          <TeddyCard key={card.id} card={card} onClick={() => removeFromDeck(card.id)} />
        ))}
      </div>
      <Button onClick={handleSaveDeck} disabled={deck.length !== 20}>
        Save Deck
      </Button>
      <Button onClick={onExit} className="ml-4">
        Exit
      </Button>
    </div>
  );
};
