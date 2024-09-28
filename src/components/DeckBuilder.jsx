import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Button } from "@/components/ui/button";
import TeddyCard from './TeddyCard';
import { useToast } from "@/components/ui/use-toast";

const DeckBuilder = () => {
  const [allTeddies, setAllTeddies] = useState([]);
  const [deck, setDeck] = useState([]);
  const [message, setMessage] = useState('');
  const { toast } = useToast();

  useEffect(() => {
    fetchTeddies();
    fetchPlayerDeck();
  }, []);

  const fetchTeddies = async () => {
    const { data, error } = await supabase.from('terrible_teddies').select('*');
    if (error) console.error('Error fetching teddies:', error);
    else setAllTeddies(data);
  };

  const fetchPlayerDeck = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data, error } = await supabase
        .from('player_decks')
        .select('deck')
        .eq('user_id', user.id)
        .single();
      if (error) {
        console.error('Error fetching player deck:', error);
      } else if (data) {
        setDeck(data.deck);
      }
    }
  };

  const addToDeck = (teddy) => {
    if (deck.length < 10 && !deck.some(t => t.id === teddy.id)) {
      setDeck([...deck, teddy]);
    } else {
      setMessage('Deck is full or teddy already added!');
    }
  };

  const removeFromDeck = (teddy) => {
    setDeck(deck.filter(t => t.id !== teddy.id));
  };

  const saveDeck = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast({
        title: "Authentication Error",
        description: "Please sign in to save your deck.",
        variant: "destructive",
      });
      return;
    }
    const { error } = await supabase.from('player_decks').upsert({
      user_id: user.id,
      deck: deck.map(t => t.id)
    });
    if (error) {
      toast({
        title: "Error",
        description: "Failed to save deck. Please try again.",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Success",
        description: "Deck saved successfully!",
        variant: "success",
      });
    }
  };

  return (
    <div className="container mx-auto p-4">
      <h2 className="text-2xl font-bold mb-4">Deck Builder</h2>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <h3 className="text-xl font-semibold mb-2">Available Teddies</h3>
          <div className="grid grid-cols-2 gap-2">
            {allTeddies.map(teddy => (
              <TeddyCard key={teddy.id} teddy={teddy} onClick={() => addToDeck(teddy)} />
            ))}
          </div>
        </div>
        <div>
          <h3 className="text-xl font-semibold mb-2">Your Deck ({deck.length}/10)</h3>
          <div className="grid grid-cols-2 gap-2">
            {deck.map(teddy => (
              <TeddyCard key={teddy.id} teddy={teddy} onClick={() => removeFromDeck(teddy)} />
            ))}
          </div>
          <Button onClick={saveDeck} className="mt-4">Save Deck</Button>
        </div>
      </div>
      {message && <p className="mt-4 text-sm text-gray-600">{message}</p>}
    </div>
  );
};

export default DeckBuilder;