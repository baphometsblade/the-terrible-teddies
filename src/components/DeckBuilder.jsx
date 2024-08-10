import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { supabase } from '../integrations/supabase';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Loader2, Plus, Minus } from 'lucide-react';

export const DeckBuilder = ({ onExit }) => {
  const [deck, setDeck] = useState([]);
  const [availableCards, setAvailableCards] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCards();
  }, []);

  const fetchCards = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('generated_images')
        .select('*');
      
      if (error) throw error;

      setAvailableCards(data);
    } catch (error) {
      console.error('Error fetching cards:', error);
    } finally {
      setLoading(false);
    }
  };

  const addCardToDeck = (card) => {
    if (deck.length < 40) {
      setDeck([...deck, card]);
    } else {
      alert('Your deck is full! (40 cards maximum)');
    }
  };

  const removeCardFromDeck = (cardId) => {
    setDeck(deck.filter(card => card.name !== cardId));
  };

  if (loading) {
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
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-gray-800 p-4 rounded-lg shadow-md">
          <h3 className="text-2xl font-bold mb-4 text-yellow-400">Available Cards</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            <AnimatePresence>
              {availableCards.map((card) => (
                <motion.div
                  key={card.name}
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
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            <AnimatePresence>
              {deck.map((card) => (
                <motion.div
                  key={card.name}
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
                          onClick={() => removeCardFromDeck(card.name)} 
                          className="mt-2 bg-red-500 hover:bg-red-600 text-white"
                          size="sm"
                        >
                          <Minus className="w-4 h-4 mr-1" /> Remove
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

      <div className="mt-8 text-center">
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button 
              className="bg-yellow-400 hover:bg-yellow-500 text-gray-900 font-bold py-3 px-6 rounded-full shadow-lg transition-all duration-300 transform hover:scale-105"
            >
              Save and Exit
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent className="bg-gray-800 border border-gray-700">
            <AlertDialogHeader>
              <AlertDialogTitle className="text-yellow-400">Are you sure you want to exit?</AlertDialogTitle>
              <AlertDialogDescription className="text-gray-300">
                Your deck will be saved automatically. You can always come back to edit it later.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel className="bg-gray-700 text-gray-300 hover:bg-gray-600">Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={onExit} className="bg-yellow-400 text-gray-900 hover:bg-yellow-500">Confirm</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
};
