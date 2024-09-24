import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { DragDropContext, Droppable, Draggable } from 'react-beautiful-dnd';
import { Button } from '@/components/ui/button';
import { useToast } from "@/components/ui/use-toast";
import { useGeneratedImages, useUserDeck, useSaveUserDeck } from '../integrations/supabase';
import TeddyCard from './TeddyCard';

export const DeckBuilder = ({ onExit }) => {
  const [deck, setDeck] = useState([]);
  const [availableTeddies, setAvailableTeddies] = useState([]);
  const { data: allTeddies, isLoading, refetch } = useGeneratedImages();
  const { data: userDeck } = useUserDeck();
  const saveUserDeck = useSaveUserDeck();
  const { toast } = useToast();

  useEffect(() => {
    if (userDeck && userDeck.deck) {
      setDeck(userDeck.deck);
    }
  }, [userDeck]);

  useEffect(() => {
    if (allTeddies) {
      setAvailableTeddies(allTeddies.filter(teddy => !deck.some(deckTeddy => deckTeddy.id === teddy.id)));
    }
  }, [allTeddies, deck]);

  const onDragEnd = (result) => {
    const { source, destination } = result;

    if (!destination) return;

    if (source.droppableId === destination.droppableId) {
      const items = reorder(
        source.droppableId === 'deck' ? deck : availableTeddies,
        source.index,
        destination.index
      );

      if (source.droppableId === 'deck') {
        setDeck(items);
      } else {
        setAvailableTeddies(items);
      }
    } else {
      const result = move(
        source.droppableId === 'deck' ? deck : availableTeddies,
        source.droppableId === 'deck' ? availableTeddies : deck,
        source,
        destination
      );

      setDeck(result.deck);
      setAvailableTeddies(result.availableTeddies);
    }
  };

  const reorder = (list, startIndex, endIndex) => {
    const result = Array.from(list);
    const [removed] = result.splice(startIndex, 1);
    result.splice(endIndex, 0, removed);
    return result;
  };

  const move = (source, destination, droppableSource, droppableDestination) => {
    const sourceClone = Array.from(source);
    const destClone = Array.from(destination);
    const [removed] = sourceClone.splice(droppableSource.index, 1);

    destClone.splice(droppableDestination.index, 0, removed);

    const result = {};
    result.deck = droppableSource.droppableId === 'deck' ? sourceClone : destClone;
    result.availableTeddies = droppableSource.droppableId === 'deck' ? destClone : sourceClone;

    return result;
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
    <DragDropContext onDragEnd={onDragEnd}>
      <div className="deck-builder bg-gradient-to-r from-red-900 to-purple-900 p-6 rounded-xl shadow-lg">
        <h2 className="text-3xl font-bold mb-6 text-center text-yellow-400">Build Your Terrible Teddies Team</h2>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <Droppable droppableId="availableTeddies">
            {(provided) => (
              <div 
                ref={provided.innerRef}
                {...provided.droppableProps}
                className="bg-gray-800 p-4 rounded-lg shadow-md"
              >
                <h3 className="text-2xl font-bold mb-4 text-yellow-400">Available Teddies</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {availableTeddies.map((teddy, index) => (
                    <Draggable key={teddy.id} draggableId={teddy.id} index={index}>
                      {(provided) => (
                        <div
                          ref={provided.innerRef}
                          {...provided.draggableProps}
                          {...provided.dragHandleProps}
                        >
                          <TeddyCard teddy={teddy} />
                        </div>
                      )}
                    </Draggable>
                  ))}
                </div>
                {provided.placeholder}
              </div>
            )}
          </Droppable>
          
          <Droppable droppableId="deck">
            {(provided) => (
              <div 
                ref={provided.innerRef}
                {...provided.droppableProps}
                className="bg-gray-800 p-4 rounded-lg shadow-md"
              >
                <h3 className="text-2xl font-bold mb-4 text-yellow-400">Your Team ({deck.length}/5)</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {deck.map((teddy, index) => (
                    <Draggable key={teddy.id} draggableId={teddy.id} index={index}>
                      {(provided) => (
                        <div
                          ref={provided.innerRef}
                          {...provided.draggableProps}
                          {...provided.dragHandleProps}
                        >
                          <TeddyCard teddy={teddy} />
                        </div>
                      )}
                    </Draggable>
                  ))}
                </div>
                {provided.placeholder}
              </div>
            )}
          </Droppable>
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
    </DragDropContext>
  );
};

<lov-add-dependency>react-beautiful-dnd@latest</lov-add-dependency>

Now that we've made these changes, let's review what we've done:

1. We've enhanced the AssetGenerator component with better progress tracking and animations.
2. We've improved the GameBoard component by adding animations and refactoring it for better organization.
3. We've updated the DeckBuilder to allow for drag-and-drop functionality, making it more interactive and user-friendly.
4. We've added the react-beautiful-dnd package to enable drag-and-drop functionality.

These changes should significantly improve the user experience and make the game more engaging. The asset generation process is now more visually appealing, the game board is more dynamic, and the deck building process is more intuitive.
