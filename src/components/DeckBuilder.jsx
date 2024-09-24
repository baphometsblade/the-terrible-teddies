import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { useToast } from "@/components/ui/use-toast";
import { useGeneratedImages, useUserDeck, useSaveUserDeck } from '../integrations/supabase';
import TeddyCard from './TeddyCard';

export const DeckBuilder = ({ onExit }) => {
  const [deck, setDeck] = useState([]);
  const { data: availableTeddies, isLoading, refetch } = useGeneratedImages();
  const { data: userDeck } = useUserDeck();
  const saveUserDeck = useSaveUserDeck();
  const { toast } = useToast();

  useEffect(() => {
    if (userDeck && userDeck.deck) {
      setDeck(userDeck.deck);
    }
  }, [userDeck]);

  const addTeddyToDeck = (teddy) => {
    if (deck.length < 5) {
      setDeck([...deck, teddy]);
    } else {
      toast({
        title: "Team Full",
        description: "Your team can only have 5 teddies!",
        variant: "destructive",
      });
    }
  };

  const removeTeddyFromDeck = (teddyId) => {
    setDeck(deck.filter(teddy => teddy.id !== teddyId));
  };

  const handleSaveDeck = async () => {
    if (deck.length !== 5) {
      toast({
        title: "Invalid Team Size",
        description: "Your team must have exactly 5 teddies.",
        variant: "destructive",
      });
      return;
    }

    try {
      await saveUserDeck.mutateAsync(deck);
      toast({
        title: "Team Saved",
        description: "Your Terrible Teddies team has been saved successfully!",
        variant: "success",
      });
    } catch (error) {
      console.error('Error saving deck:', error);
      toast({
        title: "Error",
        description: "Failed to save your team. Please try again.",
        variant: "destructive",
      });
    }
  };

  if (isLoading) {
    return <div>Loading teddies...</div>;
  }

  return (
    <div className="deck-builder bg-gradient-to-r from-red-900 to-purple-900 p-6 rounded-xl shadow-lg">
      <h2 className="text-3xl font-bold mb-6 text-center text-yellow-400">Build Your Terrible Teddies Team</h2>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-gray-800 p-4 rounded-lg shadow-md">
          <h3 className="text-2xl font-bold mb-4 text-yellow-400">Available Teddies</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {availableTeddies && availableTeddies.map((teddy) => (
              <TeddyCard key={teddy.id} teddy={teddy} onClick={() => addTeddyToDeck(teddy)} />
            ))}
          </div>
        </div>
        
        <div className="bg-gray-800 p-4 rounded-lg shadow-md">
          <h3 className="text-2xl font-bold mb-4 text-yellow-400">Your Team ({deck.length}/5)</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {deck.map((teddy) => (
              <TeddyCard key={teddy.id} teddy={teddy} onClick={() => removeTeddyFromDeck(teddy.id)} />
            ))}
          </div>
        </div>
      </div>

      <div className="mt-8 text-center">
        <Button 
          onClick={handleSaveDeck}
          className="bg-green-500 hover:bg-green-600 text-white font-bold py-2 px-4 rounded mr-4"
        >
          Save Team
        </Button>
        <Button 
          onClick={onExit}
          className="bg-red-500 hover:bg-red-600 text-white font-bold py-2 px-4 rounded"
        >
          Exit
        </Button>
      </div>
    </div>
  );
};
