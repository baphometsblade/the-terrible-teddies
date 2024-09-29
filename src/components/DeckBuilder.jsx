import React, { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { Button } from "@/components/ui/button";
import TeddyCard from './TeddyCard';
import { useToast } from "@/components/ui/use-toast";
import { DragDropContext, Droppable, Draggable } from 'react-beautiful-dnd';

const DeckBuilder = () => {
  const [deck, setDeck] = useState([]);
  const [collection, setCollection] = useState([]);
  const { toast } = useToast();

  const { data: playerTeddies, isLoading, error } = useQuery({
    queryKey: ['playerTeddies'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('player_teddies')
        .select('terrible_teddies(*)')
      if (error) throw error;
      return data.map(item => item.terrible_teddies);
    },
  });

  useEffect(() => {
    if (playerTeddies) {
      setCollection(playerTeddies);
    }
  }, [playerTeddies]);

  const saveDeckMutation = useMutation({
    mutationFn: async (newDeck) => {
      const { data, error } = await supabase
        .from('player_decks')
        .upsert({ user_id: (await supabase.auth.getUser()).data.user.id, deck: newDeck.map(teddy => teddy.id) })
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast({
        title: "Deck Saved",
        description: "Your deck has been successfully saved!",
        variant: "success",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Failed to save deck: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  const onDragEnd = (result) => {
    if (!result.destination) return;

    const sourceList = result.source.droppableId === 'deck' ? deck : collection;
    const destList = result.destination.droppableId === 'deck' ? deck : collection;

    const [reorderedItem] = sourceList.splice(result.source.index, 1);
    destList.splice(result.destination.index, 0, reorderedItem);

    if (result.source.droppableId !== result.destination.droppableId) {
      if (result.destination.droppableId === 'deck' && deck.length >= 10) {
        toast({
          title: "Deck Full",
          description: "Your deck can't have more than 10 teddies!",
          variant: "destructive",
        });
        return;
      }
      setDeck([...deck]);
      setCollection([...collection]);
    }
  };

  const saveDeck = () => {
    if (deck.length !== 10) {
      toast({
        title: "Invalid Deck",
        description: "Your deck must have exactly 10 teddies!",
        variant: "destructive",
      });
      return;
    }
    saveDeckMutation.mutate(deck);
  };

  if (isLoading) return <div>Loading your teddies...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return (
    <DragDropContext onDragEnd={onDragEnd}>
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-4">Deck Builder</h1>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <h2 className="text-2xl font-bold mb-2">Your Collection</h2>
            <Droppable droppableId="collection">
              {(provided) => (
                <div {...provided.droppableProps} ref={provided.innerRef} className="grid grid-cols-2 gap-2">
                  {collection.map((teddy, index) => (
                    <Draggable key={teddy.id} draggableId={teddy.id.toString()} index={index}>
                      {(provided) => (
                        <div ref={provided.innerRef} {...provided.draggableProps} {...provided.dragHandleProps}>
                          <TeddyCard teddy={teddy} />
                        </div>
                      )}
                    </Draggable>
                  ))}
                  {provided.placeholder}
                </div>
              )}
            </Droppable>
          </div>
          <div>
            <h2 className="text-2xl font-bold mb-2">Your Deck ({deck.length}/10)</h2>
            <Droppable droppableId="deck">
              {(provided) => (
                <div {...provided.droppableProps} ref={provided.innerRef} className="grid grid-cols-2 gap-2 min-h-[200px] bg-gray-100 p-4 rounded">
                  {deck.map((teddy, index) => (
                    <Draggable key={teddy.id} draggableId={teddy.id.toString()} index={index}>
                      {(provided) => (
                        <div ref={provided.innerRef} {...provided.draggableProps} {...provided.dragHandleProps}>
                          <TeddyCard teddy={teddy} />
                        </div>
                      )}
                    </Draggable>
                  ))}
                  {provided.placeholder}
                </div>
              )}
            </Droppable>
            <Button onClick={saveDeck} className="mt-4" disabled={saveDeckMutation.isLoading}>
              {saveDeckMutation.isLoading ? 'Saving...' : 'Save Deck'}
            </Button>
          </div>
        </div>
      </div>
    </DragDropContext>
  );
};

export default DeckBuilder;