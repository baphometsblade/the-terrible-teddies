import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { motion, AnimatePresence } from 'framer-motion';
import { useToast } from "@/components/ui/use-toast";
import { useGeneratedImages, useUserDeck, useSaveUserDeck } from '../integrations/supabase';

export const DeckBuilder = ({ onExit }) => {
  const [deck, setDeck] = useState([]);
  const { data: availableCards, isLoading } = useGeneratedImages();
  const { data: userDeck } = useUserDeck();
  const saveUserDeck = useSaveUserDeck();
  const { toast } = useToast();

  useEffect(() => {
    if (userDeck && userDeck.deck) {
      setDeck(userDeck.deck);
    }
  }, [userDeck]);

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

  const renderCard = (card, inDeck = false) => (
    <motion.div
      key={`${card.id}-${inDeck ? 'deck' : 'available'}`}
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
              onClick={() => inDeck ? removeCardFromDeck(card.id) : addCardToDeck(card)} 
              className={`mt-2 ${inDeck ? 'bg-red-500 hover:bg-red-600' : 'bg-yellow-400 hover:bg-yellow-500'} text-gray-900`}
              size="sm"
            >
              {inDeck ? 'Remove' : 'Add to Deck'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );

  if (isLoading) {
    return <div>Loading cards...</div>;
  }

  return (
    <div className="deck-builder bg-gradient-to-r from-gray-900 to-gray-800 p-6 rounded-xl shadow-lg">
      <h2 className="text-3xl font-bold mb-6 text-center text-yellow-400">Deck Builder</h2>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-gray-800 p-4 rounded-lg shadow-md">
          <h3 className="text-2xl font-bold mb-4 text-yellow-400">Available Cards</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            <AnimatePresence>
              {availableCards && availableCards.map((card) => renderCard(card))}
            </AnimatePresence>
          </div>
        </div>
        
        <div className="bg-gray-800 p-4 rounded-lg shadow-md">
          <h3 className="text-2xl font-bold mb-4 text-yellow-400">Your Deck ({deck.length}/40)</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            <AnimatePresence>
              {deck.map((card) => renderCard(card, true))}
            </AnimatePresence>
          </div>
        </div>
      </div>

      <div className="mt-8 text-center">
        <Button 
          onClick={handleSaveDeck}
          className="bg-green-500 hover:bg-green-600 text-white font-bold py-2 px-4 rounded"
        >
          Save Deck
        </Button>
        <Button 
          onClick={onExit}
          className="ml-4 bg-red-500 hover:bg-red-600 text-white font-bold py-2 px-4 rounded"
        >
          Exit
        </Button>
      </div>
    </div>
  );
};
