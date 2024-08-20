import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from "@/components/ui/use-toast";
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles } from 'lucide-react';

const CARD_TYPES = ['Action', 'Trap', 'Special', 'Defense', 'Boost'];

export const DeckBuilder = ({ onSaveDeck, initialDeck }) => {
  const [deck, setDeck] = useState(initialDeck || []);
  const [availableCards, setAvailableCards] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState('All');
  const { toast } = useToast();

  useEffect(() => {
    const fetchBears = async () => {
      try {
        const response = await fetch('/api/bears');
        const data = await response.json();
        setAvailableCards(data);
      } catch (error) {
        console.error('Error fetching bears:', error);
        toast({
          title: "Error",
          description: "Failed to load bears. Please try again.",
          variant: "destructive",
        });
      }
    };

    fetchBears();
  }, []);

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
            {CARD_TYPES.map(type => (
              <SelectItem key={type} value={type}>{type}</SelectItem>
            ))}
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
                      <img src={card.imageUrl || "/placeholder.svg"} alt={card.name} className="w-full h-32 object-cover mb-2 rounded" />
                      <p className="font-bold text-purple-800">{card.name}</p>
                      <p className="text-sm text-purple-600">{card.type}</p>
                      <p className="text-xs italic text-purple-500">{card.description}</p>
                      <p className="text-xs text-purple-700 mt-1">Energy Cost: {card.energy_cost}</p>
                      <p className="text-xs text-purple-700">Attack: {card.attack} | Defense: {card.defense}</p>
                      <p className="text-xs text-purple-700">Special: {card.specialMove}</p>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
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
                      <img src={card.imageUrl || "/placeholder.svg"} alt={card.name} className="w-full h-32 object-cover mb-2 rounded" />
                      <p className="font-bold text-purple-800">{card.name}</p>
                      <p className="text-sm text-purple-600">{card.type}</p>
                      <p className="text-xs italic text-purple-500">{card.description}</p>
                      <p className="text-xs text-purple-700 mt-1">Energy Cost: {card.energy_cost}</p>
                      <p className="text-xs text-purple-700">Attack: {card.attack} | Defense: {card.defense}</p>
                      <p className="text-xs text-purple-700">Special: {card.specialMove}</p>
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