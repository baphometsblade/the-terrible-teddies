import React, { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Loader2, Plus, Minus, Save, Filter } from 'lucide-react';
import { useToast } from "@/components/ui/use-toast";
import { useGeneratedImages, useUserDeck, useSaveUserDeck } from '../integrations/supabase';
import { CardEvolution } from './CardEvolution';

export const DeckBuilder = ({ onExit }) => {
  const [deck, setDeck] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState('All');
  const [sortBy, setSortBy] = useState('name');
  const [selectedCard, setSelectedCard] = useState(null);
  const { data: availableCards, isLoading } = useGeneratedImages();
  const { data: userDeck } = useUserDeck();
  const saveUserDeck = useSaveUserDeck();
  const { toast } = useToast();

  useEffect(() => {
    if (userDeck) {
      setDeck(userDeck);
    }
  }, [userDeck]);

  const filteredAndSortedCards = useMemo(() => {
    if (!availableCards) return [];
    return availableCards
      .filter(card => 
        card.name.toLowerCase().includes(searchTerm.toLowerCase()) &&
        (typeFilter === 'All' || card.type === typeFilter)
      )
      .sort((a, b) => {
        if (sortBy === 'name') return a.name.localeCompare(b.name);
        if (sortBy === 'type') return a.type.localeCompare(b.type);
        if (sortBy === 'energy') return a.energy_cost - b.energy_cost;
        return 0;
      });
  }, [availableCards, searchTerm, typeFilter, sortBy]);

  const addCardToDeck = (card) => {
    if (deck.length < 40) {
      const cardCount = deck.filter(c => c.id === card.id).length;
      if (cardCount < 3) {
        setDeck([...deck, card]);
      } else {
        toast({
          title: "Card Limit Reached",
          description: "You can only have 3 copies of a card in your deck.",
          variant: "destructive",
        });
      }
    } else {
      toast({
        title: "Deck Full",
        description: "Your deck is full! (40 cards maximum)",
        variant: "destructive",
      });
    }
  };

  const removeCardFromDeck = (cardId) => {
    const index = deck.findIndex(card => card.id === cardId);
    if (index !== -1) {
      const newDeck = [...deck];
      newDeck.splice(index, 1);
      setDeck(newDeck);
    }
  };

  const handleSaveDeck = async () => {
    if (deck.length < 20) {
      toast({
        title: "Deck Too Small",
        description: "Your deck must have at least 20 cards.",
        variant: "destructive",
      });
      return;
    }

    try {
      await saveUserDeck.mutateAsync(deck);
      toast({
        title: "Deck Saved",
        description: "Your custom deck has been saved successfully!",
        variant: "success",
      });
    } catch (error) {
      console.error('Error saving deck:', error);
      toast({
        title: "Error",
        description: "Failed to save your deck. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleCardEvolution = (evolvedCard) => {
    setDeck(prevDeck => prevDeck.map(card => 
      card.id === evolvedCard.id ? evolvedCard : card
    ));
    setSelectedCard(null);
  };

  const getDeckStats = () => {
    const stats = {
      Action: 0,
      Trap: 0,
      Special: 0,
      Defense: 0,
      Boost: 0,
    };
    deck.forEach(card => {
      stats[card.type]++;
    });
    return stats;
  };

  const renderDeckStats = () => {
    const stats = getDeckStats();
    return (
      <div className="grid grid-cols-5 gap-2 mt-4">
        {Object.entries(stats).map(([type, count]) => (
          <div key={type} className="text-center">
            <div className="text-sm font-bold">{type}</div>
            <div className="text-lg">{count}</div>
          </div>
        ))}
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 text-purple-600 animate-spin" />
        <span className="ml-2 text-lg text-purple-700">Loading cards...</span>
      </div>
    );
  }

  return (
    <div className="deck-builder bg-gradient-to-r from-gray-900 to-gray-800 p-6 rounded-xl shadow-lg">
      <h2 className="text-3xl font-bold mb-6 text-center text-yellow-400">Deck Builder</h2>
      
      <div className="flex mb-4 space-x-4">
        <Input
          type="text"
          placeholder="Search cards..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="flex-grow"
        />
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filter by type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="All">All Types</SelectItem>
            <SelectItem value="Action">Action</SelectItem>
            <SelectItem value="Trap">Trap</SelectItem>
            <SelectItem value="Special">Special</SelectItem>
            <SelectItem value="Defense">Defense</SelectItem>
            <SelectItem value="Boost">Boost</SelectItem>
          </SelectContent>
        </Select>
        <Select value={sortBy} onValueChange={setSortBy}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Sort by" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="name">Name</SelectItem>
            <SelectItem value="type">Type</SelectItem>
            <SelectItem value="energy">Energy Cost</SelectItem>
          </SelectContent>
        </Select>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-gray-800 p-4 rounded-lg shadow-md">
          <h3 className="text-2xl font-bold mb-4 text-yellow-400">Available Cards</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            <AnimatePresence>
              {filteredAndSortedCards.map((card) => (
                <motion.div
                  key={card.id}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  whileHover={{ scale: 1.05, zIndex: 1 }}
                  whileTap={{ scale: 0.95 }}
                  transition={{ duration: 0.2 }}
                  className="relative group"
                >
                  <Card className="cursor-pointer bg-gray-700 hover:shadow-lg transition-all duration-200 overflow-hidden">
                    <CardContent className="p-0 relative">
                      <img src={card.url} alt={card.name} className="w-full h-40 object-cover" />
                      <div className="absolute inset-0 bg-black bg-opacity-50 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex flex-col justify-end p-2">
                        <p className="text-sm font-bold text-yellow-400">{card.name}</p>
                        <p className="text-xs text-gray-300">{card.type}</p>
                        <p className="text-xs text-gray-300">Cost: {card.energy_cost}</p>
                        <Button 
                          onClick={() => addCardToDeck(card)} 
                          className="mt-2 bg-yellow-400 hover:bg-yellow-500 text-gray-900"
                          size="sm"
                        >
                          <Plus className="w-4 h-4 mr-1" /> Add to Deck
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </div>
        
        <div className="bg-gray-800 p-4 rounded-lg shadow-md">
          <h3 className="text-2xl font-bold mb-4 text-yellow-400">Your Deck ({deck.length}/40)</h3>
          {renderDeckStats()}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-3 xl:grid-cols-4 gap-4 mt-4">
            <AnimatePresence>
              {deck.map((card, index) => (
                <motion.div
                  key={`${card.id}-${index}`}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  whileHover={{ scale: 1.05, zIndex: 1 }}
                  whileTap={{ scale: 0.95 }}
                  transition={{ duration: 0.2 }}
                  className="relative group"
                >
                  <Card className="cursor-pointer bg-gray-700 hover:shadow-lg transition-all duration-200 overflow-hidden">
                    <CardContent className="p-0 relative">
                      <img src={card.url} alt={card.name} className="w-full h-40 object-cover" />
                      <div className="absolute inset-0 bg-black bg-opacity-50 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex flex-col justify-end p-2">
                        <p className="text-sm font-bold text-yellow-400">{card.name}</p>
                        <p className="text-xs text-gray-300">{card.type}</p>
                        <p className="text-xs text-gray-300">Cost: {card.energy_cost}</p>
                        <Button 
                          onClick={() => removeCardFromDeck(card.id)} 
                          className="mt-2 bg-red-500 hover:bg-red-600 text-white"
                          size="sm"
                        >
                          <Minus className="w-4 h-4 mr-1" /> Remove
                        </Button>
                        <Button 
                          onClick={() => setSelectedCard(card)} 
                          className="mt-2 bg-purple-500 hover:bg-purple-600 text-white"
                          size="sm"
                        >
                          Evolve
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </div>
      </div>

      <div className="mt-8 text-center space-x-4">
        <Button 
          onClick={handleSaveDeck}
          className="bg-green-500 hover:bg-green-600 text-white font-bold py-3 px-6 rounded-full shadow-lg transition-all duration-300 transform hover:scale-105"
        >
          <Save className="w-4 h-4 mr-2" /> Save Deck
        </Button>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button 
              className="bg-yellow-400 hover:bg-yellow-500 text-gray-900 font-bold py-3 px-6 rounded-full shadow-lg transition-all duration-300 transform hover:scale-105"
            >
              Exit
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent className="bg-gray-800 border border-gray-700">
            <AlertDialogHeader>
              <AlertDialogTitle className="text-yellow-400">Are you sure you want to exit?</AlertDialogTitle>
              <AlertDialogDescription className="text-gray-300">
                Your deck changes will be saved automatically. You can always come back to edit it later.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel className="bg-gray-700 text-gray-300 hover:bg-gray-600">Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={onExit} className="bg-yellow-400 text-gray-900 hover:bg-yellow-500">Confirm Exit</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      {selectedCard && (
        <AlertDialog open={!!selectedCard} onOpenChange={() => setSelectedCard(null)}>
          <AlertDialogContent className="bg-gray-800 border border-gray-700">
            <AlertDialogHeader>
              <AlertDialogTitle className="text-yellow-400">Evolve Card</AlertDialogTitle>
              <AlertDialogDescription className="text-gray-300">
                Do you want to evolve this card? It will become stronger but cost more energy.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <CardEvolution card={selectedCard} onEvolve={handleCardEvolution} />
            <AlertDialogFooter>
              <AlertDialogCancel className="bg-gray-700 text-gray-300 hover:bg-gray-600">Cancel</AlertDialogCancel>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  );
};