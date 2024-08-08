import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { supabase } from '../integrations/supabase';

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
    return <div>Loading cards...</div>;
  }

  return (
    <div className="deck-builder">
      <h2 className="text-2xl font-bold mb-4">Deck Builder</h2>
      
      <div className="grid grid-cols-2 gap-4">
        <div>
          <h3 className="text-xl font-bold mb-2">Available Cards</h3>
          <div className="grid grid-cols-2 gap-2">
            {availableCards.map((card) => (
              <Card key={card.name} className="cursor-pointer hover:bg-gray-100" onClick={() => addCardToDeck(card)}>
                <CardContent className="p-2">
                  <img src={card.url} alt={card.name} className="w-full h-32 object-cover mb-2 rounded" />
                  <p className="text-sm font-bold">{card.name}</p>
                  <p className="text-xs">{card.type}</p>
                  <p className="text-xs">Cost: {card.energy_cost}</p>
                  <p className="text-xs">{card.prompt}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
        
        <div>
          <h3 className="text-xl font-bold mb-2">Your Deck ({deck.length}/40)</h3>
          <div className="grid grid-cols-2 gap-2">
            {deck.map((card) => (
              <Card key={card.name} className="cursor-pointer hover:bg-gray-100" onClick={() => removeCardFromDeck(card.name)}>
                <CardContent className="p-2">
                  <img src={card.url} alt={card.name} className="w-full h-32 object-cover mb-2 rounded" />
                  <p className="text-sm font-bold">{card.name}</p>
                  <p className="text-xs">{card.type}</p>
                  <p className="text-xs">Cost: {card.energy_cost}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-4">
        <Button onClick={onExit}>Save and Exit</Button>
      </div>
    </div>
  );
};
