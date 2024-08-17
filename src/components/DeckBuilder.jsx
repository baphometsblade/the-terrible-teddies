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
    if (deck.length < 30) {
      setDeck([...deck, card]);
    } else {
      toast({
        title: "Deck Full",
        description: "Your deck is full of mischief! (30 cards maximum)",
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
        description: "Your deck needs at least 20 cards to cause proper mayhem!",
        variant: "destructive",
      });
      return;
    }
    onSaveDeck(deck);
  };

  const handleAddNewCard = async () => {
    const newCard = {
      name: "Naughty New Teddy",
      type: "Teddy",
      description: "A mischievous new teddy joins the fray with a twinkle in its button eyes!",
      attack: Math.floor(Math.random() * 5) + 1,
      special_ability: "Tickle Attack",
    };

    try {
      await addCard.mutateAsync(newCard);
      toast({
        title: "Card Added",
        description: "A new troublemaker has joined your collection!",
        variant: "success",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to add new card. The teddy factory is on strike!",
        variant: "destructive",
      });
    }
  };

  if (isLoading) return <div>Loading your mischievous minions...</div>;
  if (error) return <div>Error loading cards: {error.message}</div>;

  return (
    <div className="deck-builder p-4">
      <h2 className="text-2xl font-bold mb-4 text-purple-800">Terrible Teddies Deck Builder</h2>
      <div className="flex mb-4">
        <Input
          type="text"
          placeholder="Search for trouble..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="mr-2"
        />
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filter by type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="All">All Types of Mischief</SelectItem>
            <SelectItem value="Teddy">Naughty Teddies</SelectItem>
            <SelectItem value="Action">Devious Actions</SelectItem>
            <SelectItem value="Item">Ridiculous Items</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <h3 className="text-xl font-bold mb-2 text-purple-700">Available Troublemakers</h3>
          <div className="grid grid-cols-2 gap-2">
            {filteredCards.map((card) => (
              <Card key={card.id} className="cursor-pointer hover:shadow-md bg-gradient-to-br from-pink-100 to-purple-100" onClick={() => addCardToDeck(card)}>
                <CardContent className="p-2">
                  <p className="font-bold text-purple-800">{card.name}</p>
                  <p className="text-sm text-purple-600">{card.type}</p>
                  <p className="text-xs italic text-purple-500">{card.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
          <Button onClick={handleAddNewCard} className="mt-4 bg-green-500 hover:bg-green-600 text-white">Create New Troublemaker</Button>
        </div>
        <div>
          <h3 className="text-xl font-bold mb-2 text-purple-700">Your Mischief Squad ({deck.length}/30)</h3>
          <div className="grid grid-cols-2 gap-2">
            {deck.map((card, index) => (
              <Card key={index} className="cursor-pointer hover:shadow-md bg-gradient-to-br from-blue-100 to-purple-100" onClick={() => removeCardFromDeck(index)}>
                <CardContent className="p-2">
                  <p className="font-bold text-purple-800">{card.name}</p>
                  <p className="text-sm text-purple-600">{card.type}</p>
                  <p className="text-xs italic text-purple-500">{card.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
          <Button onClick={handleSaveDeck} className="mt-4 bg-purple-500 hover:bg-purple-600 text-white">Save Your Mischief Squad</Button>
        </div>
      </div>
    </div>
  );
};