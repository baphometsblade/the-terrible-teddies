import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import TeddyCard from './TeddyCard';
import { useToast } from "@/components/ui/use-toast";
import { motion, AnimatePresence } from 'framer-motion';

// All available cards for deck building
const ALL_CARDS = [
  { id: 1, name: "Teddy Troublemaker", attack: 3, defense: 2, type: 'action', cost: 2, ability: 'none' },
  { id: 2, name: "Sassy Sally", attack: 2, defense: 3, type: 'action', cost: 2, ability: 'taunt' },
  { id: 3, name: "Bear Trap", attack: 0, defense: 0, type: 'trap', cost: 2, effect: 'damage', amount: 3 },
  { id: 4, name: "Stuffing Surge", attack: 0, defense: 0, type: 'special', cost: 3, effect: 'heal', amount: 5 },
  { id: 5, name: "Pillow Fighter", attack: 4, defense: 1, type: 'action', cost: 3, ability: 'piercing' },
  { id: 6, name: "Cuddle Crusher", attack: 2, defense: 4, type: 'action', cost: 3, ability: 'shield' },
  { id: 7, name: "Sneaky Pete", attack: 3, defense: 1, type: 'action', cost: 2, ability: 'stealth' },
  { id: 8, name: "Honey Jar", attack: 0, defense: 0, type: 'special', cost: 2, effect: 'draw', amount: 2 },
  { id: 9, name: "Fluff Bomb", attack: 5, defense: 0, type: 'action', cost: 4, ability: 'none' },
  { id: 10, name: "Guardian Bear", attack: 1, defense: 5, type: 'action', cost: 3, ability: 'protect' },
  { id: 11, name: "Rage Bear", attack: 4, defense: 2, type: 'action', cost: 3, ability: 'fury' },
  { id: 12, name: "Tiny Tim", attack: 1, defense: 1, type: 'action', cost: 1, ability: 'swarm' },
  { id: 13, name: "Cotton King", attack: 3, defense: 3, type: 'action', cost: 4, ability: 'royal' },
  { id: 14, name: "Surprise Hug", attack: 0, defense: 0, type: 'trap', cost: 1, effect: 'damage', amount: 2 },
  { id: 15, name: "Stuffing Explosion", attack: 0, defense: 0, type: 'trap', cost: 3, effect: 'damage', amount: 4 },
  { id: 16, name: "Button Eyes", attack: 0, defense: 0, type: 'special', cost: 2, effect: 'draw', amount: 1 },
  { id: 17, name: "Emergency Repair", attack: 0, defense: 0, type: 'special', cost: 4, effect: 'heal', amount: 8 },
  { id: 18, name: "Teddy Rally", attack: 0, defense: 0, type: 'special', cost: 3, effect: 'buff', amount: 1 },
];

const DECK_SIZE = 10;

const DeckBuilder = () => {
  const [deck, setDeck] = useState([]);
  const [filter, setFilter] = useState('all');
  const { toast } = useToast();

  const filteredCards = ALL_CARDS.filter(card => {
    if (filter === 'all') return true;
    return card.type === filter;
  });

  const addToDeck = (card) => {
    if (deck.length >= DECK_SIZE) {
      toast({
        title: "Deck Full!",
        description: `Your deck can only have ${DECK_SIZE} cards.`,
        variant: "destructive",
      });
      return;
    }

    // Check if card is already in deck (max 2 copies)
    const copies = deck.filter(c => c.id === card.id).length;
    if (copies >= 2) {
      toast({
        title: "Max Copies!",
        description: "You can only have 2 copies of each card.",
        variant: "destructive",
      });
      return;
    }

    // Add with unique deck ID
    const deckCard = { ...card, deckId: `${card.id}-${Date.now()}` };
    setDeck([...deck, deckCard]);
    toast({
      title: "Card Added!",
      description: `${card.name} added to deck.`,
    });
  };

  const removeFromDeck = (deckCard) => {
    setDeck(deck.filter(c => c.deckId !== deckCard.deckId));
    toast({
      title: "Card Removed",
      description: `${deckCard.name} removed from deck.`,
    });
  };

  const saveDeck = () => {
    if (deck.length !== DECK_SIZE) {
      toast({
        title: "Invalid Deck",
        description: `Your deck must have exactly ${DECK_SIZE} cards!`,
        variant: "destructive",
      });
      return;
    }

    // Save to localStorage for now
    localStorage.setItem('terribleTeddiesDeck', JSON.stringify(deck));
    toast({
      title: "Deck Saved!",
      description: "Your deck has been saved successfully.",
    });
  };

  const clearDeck = () => {
    setDeck([]);
    toast({
      title: "Deck Cleared",
      description: "All cards removed from deck.",
    });
  };

  // Calculate deck stats
  const totalCost = deck.reduce((sum, card) => sum + card.cost, 0);
  const avgCost = deck.length > 0 ? (totalCost / deck.length).toFixed(1) : 0;
  const typeCount = {
    action: deck.filter(c => c.type === 'action').length,
    trap: deck.filter(c => c.type === 'trap').length,
    special: deck.filter(c => c.type === 'special').length,
  };

  return (
    <div className="max-w-7xl mx-auto">
      <h1 className="text-4xl font-bold text-white mb-6 text-center">
        Deck Builder
      </h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Card Collection */}
        <div className="lg:col-span-2">
          <div className="bg-white/10 rounded-xl p-4">
            <h2 className="text-xl font-bold text-white mb-4">Card Collection</h2>

            {/* Filter buttons */}
            <div className="flex gap-2 mb-4">
              {['all', 'action', 'trap', 'special'].map(type => (
                <button
                  key={type}
                  onClick={() => setFilter(type)}
                  className={`
                    px-3 py-1 rounded text-sm font-semibold transition-all
                    ${filter === type
                      ? 'bg-white text-purple-900'
                      : 'bg-white/20 text-white hover:bg-white/30'
                    }
                  `}
                >
                  {type.charAt(0).toUpperCase() + type.slice(1)}
                </button>
              ))}
            </div>

            {/* Cards grid */}
            <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
              {filteredCards.map((card) => {
                const copiesInDeck = deck.filter(c => c.id === card.id).length;
                return (
                  <motion.div
                    key={card.id}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className="relative cursor-pointer"
                    onClick={() => addToDeck(card)}
                  >
                    <TeddyCard teddy={card} isDisabled={copiesInDeck >= 2} />
                    {copiesInDeck > 0 && (
                      <div className="absolute -top-2 -right-2 bg-yellow-500 text-black w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold">
                        {copiesInDeck}
                      </div>
                    )}
                  </motion.div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Deck Panel */}
        <div className="lg:col-span-1">
          <div className="bg-white/10 rounded-xl p-4 sticky top-4">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-white">
                Your Deck ({deck.length}/{DECK_SIZE})
              </h2>
              <Button
                variant="outline"
                size="sm"
                onClick={clearDeck}
                className="text-red-400 border-red-400 hover:bg-red-400/20"
              >
                Clear
              </Button>
            </div>

            {/* Deck stats */}
            <div className="grid grid-cols-3 gap-2 mb-4 text-center text-sm">
              <div className="bg-amber-500/30 rounded p-2">
                <div className="text-amber-300 font-bold">{typeCount.action}</div>
                <div className="text-white/70">Action</div>
              </div>
              <div className="bg-purple-500/30 rounded p-2">
                <div className="text-purple-300 font-bold">{typeCount.trap}</div>
                <div className="text-white/70">Trap</div>
              </div>
              <div className="bg-cyan-500/30 rounded p-2">
                <div className="text-cyan-300 font-bold">{typeCount.special}</div>
                <div className="text-white/70">Special</div>
              </div>
            </div>

            <div className="text-white/70 text-sm mb-4">
              Avg. Cost: <span className="text-yellow-400 font-bold">{avgCost}</span>
            </div>

            {/* Deck cards */}
            <div className="space-y-2 max-h-96 overflow-y-auto mb-4">
              <AnimatePresence>
                {deck.map((card, index) => (
                  <motion.div
                    key={card.deckId}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="flex items-center justify-between bg-white/10 rounded-lg p-2"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-yellow-400 font-bold w-6">{card.cost}</span>
                      <span className="text-white text-sm">{card.name}</span>
                    </div>
                    <button
                      onClick={() => removeFromDeck(card)}
                      className="text-red-400 hover:text-red-300 text-lg"
                    >
                      ×
                    </button>
                  </motion.div>
                ))}
              </AnimatePresence>

              {deck.length === 0 && (
                <div className="text-white/50 text-center py-8">
                  Click cards to add them to your deck
                </div>
              )}
            </div>

            {/* Save button */}
            <Button
              onClick={saveDeck}
              disabled={deck.length !== DECK_SIZE}
              className={`w-full ${
                deck.length === DECK_SIZE
                  ? 'bg-green-500 hover:bg-green-600'
                  : 'bg-gray-500 cursor-not-allowed'
              }`}
            >
              {deck.length === DECK_SIZE ? 'Save Deck' : `Need ${DECK_SIZE - deck.length} more cards`}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DeckBuilder;
