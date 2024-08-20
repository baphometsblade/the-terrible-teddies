import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from "@/components/ui/use-toast";
import { useTerribleTeddiesCards, useAddTerribleTeddiesCard } from '../integrations/supabase';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles } from 'lucide-react';

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
      toast({
        title: "Card Added",
        description: `${card.name} has been added to your deck!`,
        variant: "success",
      });
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
    const removedCard = newDeck.splice(index, 1)[0];
    setDeck(newDeck);
    toast({
      title: "Card Removed",
      description: `${removedCard.name} has been removed from your deck.`,
      variant: "default",
    });
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

  if (isLoading) return <div className="text-center text-2xl text-purple-600">Loading your mischievous minions...</div>;
  if (error) return <div className="text-center text-2xl text-red-600">Error loading cards: {error.message}</div>;

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="deck-builder p-6 bg-gradient-to-r from-purple-100 to-pink-100 rounded-lg shadow-lg"
    >
      <h2 className="text-4xl font-bold mb-8 text-center text-purple-800">Terrible Teddies Deck Builder</h2>
      <div className="flex mb-6 space-x-4">
        <Input
          type="text"
          placeholder="Search for trouble..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="flex-grow"
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
      <div className="grid grid-cols-2 gap-8">
        <div>
          <h3 className="text-2xl font-bold mb-4 text-purple-700">Available Troublemakers</h3>
          <div className="grid grid-cols-2 gap-4 h-[60vh] overflow-y-auto p-4 bg-white bg-opacity-50 rounded-lg">
            <AnimatePresence>
              {filteredCards.map((card) => (
                <motion.div
                  key={card.id}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <Card 
                    className="cursor-pointer hover:shadow-md bg-gradient-to-br from-pink-100 to-purple-100 transition-all duration-300" 
                    onClick={() => addCardToDeck(card)}
                  >
                    <CardContent className="p-4">
                      <p className="font-bold text-purple-800">{card.name}</p>
                      <p className="text-sm text-purple-600">{card.type}</p>
                      <p className="text-xs italic text-purple-500">{card.description}</p>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
          <Button onClick={handleAddNewCard} className="mt-4 w-full bg-green-500 hover:bg-green-600 text-white transition-all duration-300">
            <Sparkles className="w-5 h-5 mr-2" />
            Create New Troublemaker
          </Button>
        </div>
        <div>
          <h3 className="text-2xl font-bold mb-4 text-purple-700">Your Mischief Squad ({deck.length}/30)</h3>
          <div className="grid grid-cols-2 gap-4 h-[60vh] overflow-y-auto p-4 bg-white bg-opacity-50 rounded-lg">
            <AnimatePresence>
              {deck.map((card, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <Card 
                    className="cursor-pointer hover:shadow-md bg-gradient-to-br from-blue-100 to-purple-100 transition-all duration-300" 
                    onClick={() => removeCardFromDeck(index)}
                  >
                    <CardContent className="p-4">
                      <p className="font-bold text-purple-800">{card.name}</p>
                      <p className="text-sm text-purple-600">{card.type}</p>
                      <p className="text-xs italic text-purple-500">{card.description}</p>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
          <Button 
            onClick={handleSaveDeck} 
            className="mt-4 w-full bg-purple-500 hover:bg-purple-600 text-white transition-all duration-300"
            disabled={deck.length < 20}
          >
            Save Your Mischief Squad
          </Button>
        </div>
      </div>
    </motion.div>
  );
};