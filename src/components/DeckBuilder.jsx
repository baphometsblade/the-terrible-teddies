import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import TeddyCard from './TeddyCard';
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";

const fetchTeddies = async () => {
  const { data, error } = await supabase
    .from('terrible_teddies')
    .select('*');
  if (error) throw error;
  return data;
};

const DeckBuilder = () => {
  const [deck, setDeck] = useState([]);
  const { data: teddies, isLoading, error } = useQuery({
    queryKey: ['teddies'],
    queryFn: fetchTeddies,
  });
  const { toast } = useToast();

  const addToDeck = (teddy) => {
    if (deck.length < 20 && !deck.find(t => t.id === teddy.id)) {
      setDeck([...deck, teddy]);
    } else {
      toast({
        title: "Cannot add to deck",
        description: deck.length >= 20 ? "Deck is full" : "Teddy already in deck",
        variant: "destructive",
      });
    }
  };

  const removeFromDeck = (teddyId) => {
    setDeck(deck.filter(t => t.id !== teddyId));
  };

  const saveDeck = async () => {
    if (deck.length !== 20) {
      toast({
        title: "Cannot save deck",
        description: "Deck must contain exactly 20 teddies",
        variant: "destructive",
      });
      return;
    }

    const { data, error } = await supabase
      .from('player_decks')
      .insert({ deck: deck.map(t => t.id) });

    if (error) {
      toast({
        title: "Error saving deck",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Deck saved successfully",
        variant: "success",
      });
    }
  };

  if (isLoading) return <div>Loading teddies...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-4">Deck Builder</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <h2 className="text-2xl font-bold mb-2">Available Teddies</h2>
          <div className="grid grid-cols-2 gap-2">
            {teddies.map(teddy => (
              <TeddyCard key={teddy.id} teddy={teddy} onClick={() => addToDeck(teddy)} />
            ))}
          </div>
        </div>
        <div>
          <h2 className="text-2xl font-bold mb-2">Your Deck ({deck.length}/20)</h2>
          <div className="grid grid-cols-2 gap-2">
            {deck.map(teddy => (
              <TeddyCard key={teddy.id} teddy={teddy} onClick={() => removeFromDeck(teddy.id)} />
            ))}
          </div>
          <Button onClick={saveDeck} className="mt-4" disabled={deck.length !== 20}>Save Deck</Button>
        </div>
      </div>
    </div>
  );
};

export default DeckBuilder;