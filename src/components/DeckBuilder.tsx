import React, { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { TeddyCard, Deck } from '../types/types';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/use-toast";

const DeckBuilder: React.FC = () => {
  const [selectedCards, setSelectedCards] = useState<TeddyCard[]>([]);
  const [deckName, setDeckName] = useState('');
  const { toast } = useToast();

  const { data: allCards, isLoading } = useQuery({
    queryKey: ['allCards'],
    queryFn: async () => {
      const { data, error } = await supabase.from('terrible_teddies').select('*');
      if (error) throw error;
      return data as TeddyCard[];
    },
  });

  const saveDeckMutation = useMutation({
    mutationFn: async (newDeck: Deck) => {
      const { data, error } = await supabase.from('decks').insert(newDeck);
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast({
        title: "Deck Saved",
        description: "Your deck has been successfully saved!",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Failed to save deck: ${error}`,
        variant: "destructive",
      });
    },
  });

  const handleCardSelect = (card: TeddyCard) => {
    if (selectedCards.length < 30 && !selectedCards.find(c => c.id === card.id)) {
      setSelectedCards([...selectedCards, card]);
    }
  };

  const handleCardRemove = (card: TeddyCard) => {
    setSelectedCards(selectedCards.filter(c => c.id !== card.id));
  };

  const handleSaveDeck = () => {
    if (selectedCards.length !== 30) {
      toast({
        title: "Invalid Deck",
        description: "Your deck must contain exactly 30 cards.",
        variant: "destructive",
      });
      return;
    }

    const newDeck: Deck = {
      id: crypto.randomUUID(),
      name: deckName,
      cards: selectedCards,
    };

    saveDeckMutation.mutate(newDeck);
  };

  if (isLoading) return <div>Loading cards...</div>;

  return (
    <div className="deck-builder p-4">
      <h2 className="text-2xl font-bold mb-4">Deck Builder</h2>
      <Input
        type="text"
        placeholder="Deck Name"
        value={deckName}
        onChange={(e) => setDeckName(e.target.value)}
        className="mb-4"
      />
      <div className="grid grid-cols-2 gap-4">
        <div>
          <h3 className="text-xl font-semibold mb-2">Available Cards</h3>
          <div className="grid grid-cols-3 gap-2">
            {allCards?.map(card => (
              <Card key={card.id} className="cursor-pointer" onClick={() => handleCardSelect(card)}>
                <CardHeader>
                  <CardTitle>{card.name}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p>Attack: {card.attack}</p>
                  <p>Defense: {card.defense}</p>
                  <p>Energy: {card.energyCost}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
        <div>
          <h3 className="text-xl font-semibold mb-2">Selected Cards ({selectedCards.length}/30)</h3>
          <div className="grid grid-cols-3 gap-2">
            {selectedCards.map(card => (
              <Card key={card.id} className="cursor-pointer" onClick={() => handleCardRemove(card)}>
                <CardHeader>
                  <CardTitle>{card.name}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p>Attack: {card.attack}</p>
                  <p>Defense: {card.defense}</p>
                  <p>Energy: {card.energyCost}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
      <Button onClick={handleSaveDeck} className="mt-4" disabled={selectedCards.length !== 30 || !deckName}>
        Save Deck
      </Button>
    </div>
  );
};

export default DeckBuilder;