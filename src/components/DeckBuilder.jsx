import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { useQuery, useMutation } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';

const fetchCards = async () => {
  const { data, error } = await supabase.from('generated_images').select('*');
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
    mutationFn: async (newDeck) => {
      const { data, error } = await supabase.from('user_decks').upsert({ deck: newDeck });
      if (error) throw error;
      return data;
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

  if (isLoading) return <div>Loading cards...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return (
    <div className="deck-builder">
      <h2 className="text-2xl font-bold mb-4">Deck Builder</h2>
      <div className="grid grid-cols-5 gap-4 mb-8">
        {cards.map((card) => (
          <div key={card.id} className="card" onClick={() => addToDeck(card)}>
            <img src={card.url} alt={card.name} className="w-full h-32 object-cover rounded" />
            <p className="text-sm mt-1">{card.name}</p>
          </div>
        ))}
      </div>
      <h3 className="text-xl font-bold mb-4">Your Deck ({deck.length}/20)</h3>
      <div className="grid grid-cols-5 gap-4 mb-8">
        {deck.map((card) => (
          <div key={card.id} className="card" onClick={() => removeFromDeck(card.id)}>
            <img src={card.url} alt={card.name} className="w-full h-32 object-cover rounded" />
            <p className="text-sm mt-1">{card.name}</p>
          </div>
        ))}
      </div>
      <Button onClick={() => saveDeckMutation.mutate(deck)} disabled={deck.length !== 20}>
        Save Deck
      </Button>
      <Button onClick={onExit} className="ml-4">
        Exit
      </Button>
    </div>
  );
};
