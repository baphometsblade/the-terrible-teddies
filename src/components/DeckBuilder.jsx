import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

export const DeckBuilder = ({ onExit }) => {
  const [deck, setDeck] = useState([]);
  const [availableCards, setAvailableCards] = useState([
    { id: 1, name: 'Pillow Fight', type: 'Action', energyCost: 2, effect: 'Deal 3 damage and make the opponent discard a card' },
    { id: 2, name: 'Bear Trap', type: 'Trap', energyCost: 1, effect: 'Negate an attack and deal 2 damage back' },
    { id: 3, name: 'Stuffing Surge', type: 'Special', energyCost: 3, effect: 'Heal 5 HP' },
    // Add more cards here
  ]);

  const addCardToDeck = (card) => {
    if (deck.length < 40) {
      setDeck([...deck, card]);
    } else {
      alert('Your deck is full! (40 cards maximum)');
    }
  };

  const removeCardFromDeck = (cardId) => {
    setDeck(deck.filter(card => card.id !== cardId));
  };

  return (
    <div className="deck-builder">
      <h2 className="text-2xl font-bold mb-4">Deck Builder</h2>
      
      <div className="grid grid-cols-2 gap-4">
        <div>
          <h3 className="text-xl font-bold mb-2">Available Cards</h3>
          <div className="grid grid-cols-2 gap-2">
            {availableCards.map((card) => (
              <Card key={card.id} className="cursor-pointer hover:bg-gray-100" onClick={() => addCardToDeck(card)}>
                <CardContent className="p-2">
                  <p className="text-sm font-bold">{card.name}</p>
                  <p className="text-xs">{card.type}</p>
                  <p className="text-xs">Cost: {card.energyCost}</p>
                  <p className="text-xs">{card.effect}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
        
        <div>
          <h3 className="text-xl font-bold mb-2">Your Deck ({deck.length}/40)</h3>
          <div className="grid grid-cols-2 gap-2">
            {deck.map((card) => (
              <Card key={card.id} className="cursor-pointer hover:bg-gray-100" onClick={() => removeCardFromDeck(card.id)}>
                <CardContent className="p-2">
                  <p className="text-sm font-bold">{card.name}</p>
                  <p className="text-xs">{card.type}</p>
                  <p className="text-xs">Cost: {card.energyCost}</p>
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
