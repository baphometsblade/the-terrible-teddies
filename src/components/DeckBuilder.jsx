import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from "@/components/ui/use-toast";
import { useTerribleTeddiesCards, useAddTerribleTeddiesCard } from '../integrations/supabase';

export const DeckBuilder = ({ onSaveDeck }) => {
  const [deck, setDeck] = useState([]);
  const [availableCards, setAvailableCards] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState('All');
  const { data: cards, isLoading, error } = useTerribleTeddiesCards();
  const addCard = useAddTerribleTeddiesCard();
  const { toast } = useToast();

  useEffect(() => {
    if (cards) {
      setAvailableCards(cards);
    }
  }, [cards]);

  const filteredCards = availableCards.filter(card => 
    card.name.toLowerCase().includes(searchTerm.toLowerCase()) &&
    (typeFilter === 'All' || card.type === typeFilter)
  );

  const addCardToDeck = (card) => {
    if (deck.length < 40) {
      setDeck([...deck, card]);
    } else {
      toast({
        title: "Deck Full",
        description: "Your deck is full! (40 cards maximum)",
        variant: "destructive",
      });
    }
  };

  const removeCardFromDeck = (index) => {
    const newDeck = [...deck];
    newDeck.splice(index, 1);
    setDeck(newDeck);
  };

  const handleSaveDeck = () => {
    if (deck.length < 20) {
      toast({
        title: "Deck Too Small",
        description: "Your deck must have at least 20 cards.",
        variant: "destructive",
      });
      return;
    }
    onSaveDeck(deck);
  };

  const handleAddNewCard = async () => {
    const newCard = {
      name: "New Terrible Teddy",
      type: "Teddy",
      description: "A naughty new teddy joins the fray!",
      attack: 2,
      defense: 2,
    };

    try {
      await addCard.mutateAsync(newCard);
      toast({
        title: "Card Added",
        description: "New card has been added to the collection!",
        variant: "success",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to add new card. Please try again.",
        variant: "destructive",
      });
    }
  };

  if (isLoading) return <div>Loading cards...</div>;
  if (error) return <div>Error loading cards: {error.message}</div>;

  return (
    <div className="deck-builder p-4">
      <h2 className="text-2xl font-bold mb-4">Deck Builder</h2>
      <div className="flex mb-4">
        <Input
          type="text"
          placeholder="Search cards..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="mr-2"
        />
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filter by type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="All">All Types</SelectItem>
            <SelectItem value="Teddy">Teddy</SelectItem>
            <SelectItem value="Action">Action</SelectItem>
            <SelectItem value="Item">Item</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <h3 className="text-xl font-bold mb-2">Available Cards</h3>
          <div className="grid grid-cols-2 gap-2">
            {filteredCards.map((card) => (
              <Card key={card.id} className="cursor-pointer hover:shadow-md" onClick={() => addCardToDeck(card)}>
                <CardContent className="p-2">
                  <p className="font-bold">{card.name}</p>
                  <p className="text-sm">{card.type}</p>
                </CardContent>
              </Card>
            ))}
          </div>
          <Button onClick={handleAddNewCard} className="mt-4">Add New Card</Button>
        </div>
        <div>
          <h3 className="text-xl font-bold mb-2">Your Deck ({deck.length}/40)</h3>
          <div className="grid grid-cols-2 gap-2">
            {deck.map((card, index) => (
              <Card key={index} className="cursor-pointer hover:shadow-md" onClick={() => removeCardFromDeck(index)}>
                <CardContent className="p-2">
                  <p className="font-bold">{card.name}</p>
                  <p className="text-sm">{card.type}</p>
                </CardContent>
              </Card>
            ))}
          </div>
          <Button onClick={handleSaveDeck} className="mt-4">Save Deck</Button>
        </div>
      </div>
    </div>
  );
};