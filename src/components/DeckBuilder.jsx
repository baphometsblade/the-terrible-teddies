import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { supabase } from '../integrations/supabase';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Loader2 } from 'lucide-react';

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
    <div className="deck-builder bg-gradient-to-r from-pink-100 to-purple-200 p-6 rounded-xl shadow-lg">
      <h2 className="text-3xl font-bold mb-6 text-center text-purple-800">Deck Builder</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="bg-white p-4 rounded-lg shadow-md">
          <h3 className="text-2xl font-bold mb-4 text-purple-700">Available Cards</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <AnimatePresence>
              {availableCards.map((card) => (
                <motion.div
                  key={card.name}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  transition={{ duration: 0.2 }}
                >
                  <Card className="cursor-pointer bg-gradient-to-br from-blue-100 to-purple-100 hover:shadow-lg transition-all duration-200" onClick={() => addCardToDeck(card)}>
                    <CardContent className="p-3">
                      <img src={card.url} alt={card.name} className="w-full h-32 object-cover mb-2 rounded" />
                      <p className="text-sm font-bold text-purple-800">{card.name}</p>
                      <p className="text-xs text-purple-600">{card.type}</p>
                      <p className="text-xs text-purple-700">Cost: {card.energy_cost}</p>
                      <p className="text-xs italic text-purple-600 truncate">{card.prompt}</p>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </div>
        
        <div className="bg-white p-4 rounded-lg shadow-md">
          <h3 className="text-2xl font-bold mb-4 text-purple-700">Your Deck ({deck.length}/40)</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <AnimatePresence>
              {deck.map((card) => (
                <motion.div
                  key={card.name}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  transition={{ duration: 0.2 }}
                >
                  <Card className="cursor-pointer bg-gradient-to-br from-pink-100 to-red-100 hover:shadow-lg transition-all duration-200" onClick={() => removeCardFromDeck(card.name)}>
                    <CardContent className="p-3">
                      <img src={card.url} alt={card.name} className="w-full h-32 object-cover mb-2 rounded" />
                      <p className="text-sm font-bold text-purple-800">{card.name}</p>
                      <p className="text-xs text-purple-600">{card.type}</p>
                      <p className="text-xs text-purple-700">Cost: {card.energy_cost}</p>
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
              className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white font-bold py-3 px-6 rounded-full shadow-lg transition-all duration-300 transform hover:scale-105"
            >
              Save and Exit
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Are you sure you want to exit?</AlertDialogTitle>
              <AlertDialogDescription>
                Your deck will be saved automatically. You can always come back to edit it later.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={onExit}>Confirm</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
};
