import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import TeddyCard from './TeddyCard';
import { useToast } from "@/components/ui/use-toast";
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore, ALL_CARDS } from '../stores/gameStore';
import { pressable } from '@/lib/a11y';

import { RARITY } from '@/lib/rarity';

const DECK_SIZE = 10;
const MAX_COPIES = 2;

const DeckBuilder = () => {
  const { ownedCards, currentDeck, setCurrentDeck, savedDecks, saveDeck, deleteDeck } = useGameStore();
  const [deck, setDeck] = useState([]);
  const [filter, setFilter] = useState('all');
  const [deckName, setDeckName] = useState('');
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const { toast } = useToast();

  const ownedCardObjects = ALL_CARDS.filter(card => ownedCards.includes(card.id));

  useEffect(() => {
    const initialDeck = currentDeck.map((id, idx) => {
      const card = ALL_CARDS.find(c => c.id === id);
      return card ? { ...card, deckId: `${id}-${idx}` } : null;
    }).filter(Boolean);
    setDeck(initialDeck);
  }, [currentDeck]);

  const filteredCards = ownedCardObjects.filter(card => {
    if (filter === 'all') return true;
    return card.type === filter;
  });

  const addToDeck = (card) => {
    if (deck.length >= DECK_SIZE) {
      toast({ title: "Deck Full!", description: `Max ${DECK_SIZE} cards.`, variant: "destructive" });
      return;
    }
    const copies = deck.filter(c => c.id === card.id).length;
    if (copies >= MAX_COPIES) {
      toast({ title: "Max Copies!", description: `Max ${MAX_COPIES} copies per card.`, variant: "destructive" });
      return;
    }
    setDeck([...deck, { ...card, deckId: `${card.id}-${Date.now()}` }]);
  };

  const removeFromDeck = (deckCard) => {
    setDeck(deck.filter(c => c.deckId !== deckCard.deckId));
  };

  const handleSaveDeck = () => {
    if (deck.length !== DECK_SIZE) {
      toast({ title: "Invalid Deck", description: `Need ${DECK_SIZE} cards!`, variant: "destructive" });
      return;
    }
    const cardIds = deck.map(c => c.id);
    setCurrentDeck(cardIds);

    if (deckName.trim()) {
      saveDeck(deckName.trim(), cardIds);
      setShowSaveDialog(false);
      setDeckName('');
      toast({ title: "Deck Saved!", description: `"${deckName.trim()}" saved.` });
    } else {
      toast({ title: "Deck Set!", description: "Current deck updated." });
    }
  };

  const loadSavedDeck = (savedDeckData) => {
    const loadedDeck = savedDeckData.cards.map((id, idx) => {
      const card = ALL_CARDS.find(c => c.id === id);
      return card ? { ...card, deckId: `${id}-${idx}` } : null;
    }).filter(Boolean);
    setDeck(loadedDeck);
    toast({ title: "Deck Loaded", description: `"${savedDeckData.name}" loaded.` });
  };

  const clearDeck = () => setDeck([]);

  const totalCost = deck.reduce((sum, card) => sum + card.cost, 0);
  const avgCost = deck.length > 0 ? (totalCost / deck.length).toFixed(1) : 0;
  const typeCount = {
    action: deck.filter(c => c.type === 'action').length,
    trap: deck.filter(c => c.type === 'trap').length,
    special: deck.filter(c => c.type === 'special').length,
  };
  const rarityCount = {
    common: deck.filter(c => c.rarity === 'common').length,
    uncommon: deck.filter(c => c.rarity === 'uncommon').length,
    rare: deck.filter(c => c.rarity === 'rare').length,
    epic: deck.filter(c => c.rarity === 'epic').length,
    legendary: deck.filter(c => c.rarity === 'legendary').length,
  };

  return (
    <div className="max-w-7xl mx-auto">
      <h1 className="text-4xl font-display font-bold bg-gradient-to-r from-brass-300 to-brass-500 bg-clip-text text-transparent mb-6 text-center">Deck Builder</h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <div className="bg-night-800/60 border border-plush-700/40 rounded-xl p-4">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-white">Your Cards ({ownedCardObjects.length})</h2>
            </div>

            <div className="flex gap-2 mb-4 flex-wrap">
              {['all', 'action', 'trap', 'special'].map(type => (
                <button
                  key={type}
                  onClick={() => setFilter(type)}
                  className={`px-3 py-1 rounded text-sm font-semibold transition-all ${
                    filter === type ? 'bg-brass-400 text-night-950' : 'bg-white/10 text-plush-300 hover:bg-white/20'
                  }`}
                >
                  {type.charAt(0).toUpperCase() + type.slice(1)}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 max-h-[500px] overflow-y-auto justify-items-center">
              {filteredCards.map((card) => {
                const copiesInDeck = deck.filter(c => c.id === card.id).length;
                const isMaxed = copiesInDeck >= MAX_COPIES;
                return (
                  <motion.div
                    key={card.id}
                    whileHover={{ scale: isMaxed ? 1 : 1.05 }}
                    whileTap={{ scale: isMaxed ? 1 : 0.95 }}
                    className={`relative cursor-pointer ${isMaxed ? 'opacity-50' : ''}`}
                    {...pressable(() => !isMaxed && addToDeck(card), `Add ${card.name} to deck`)}
                  >
                    <div className={`absolute inset-0 rounded-lg blur-md -z-10 opacity-30 bg-gradient-to-r ${RARITY[card.rarity].gradient}`} />
                    <TeddyCard teddy={card} isDisabled={isMaxed} />
                    {copiesInDeck > 0 && (
                      <div className="absolute -top-2 -right-2 bg-brass-400 text-night-950 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold z-10">
                        {copiesInDeck}
                      </div>
                    )}
                  </motion.div>
                );
              })}
            </div>

            {filteredCards.length === 0 && (
              <div className="text-center text-white/50 py-8">No cards available. Open packs!</div>
            )}
          </div>
        </div>

        <div className="lg:col-span-1">
          <div className="bg-night-800/60 border border-plush-700/40 rounded-xl p-4 sticky top-4">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-white">Deck ({deck.length}/{DECK_SIZE})</h2>
              <Button variant="outline" size="sm" onClick={clearDeck} className="text-red-400 border-red-400 hover:bg-red-400/20">
                Clear
              </Button>
            </div>

            <div className="grid grid-cols-3 gap-2 mb-4 text-center text-sm">
              <div className="bg-amber-500/30 rounded p-2">
                <div className="text-amber-300 font-bold">{typeCount.action}</div>
                <div className="text-white/70 text-xs">Action</div>
              </div>
              <div className="bg-purple-500/30 rounded p-2">
                <div className="text-purple-300 font-bold">{typeCount.trap}</div>
                <div className="text-white/70 text-xs">Trap</div>
              </div>
              <div className="bg-cyan-500/30 rounded p-2">
                <div className="text-cyan-300 font-bold">{typeCount.special}</div>
                <div className="text-white/70 text-xs">Special</div>
              </div>
            </div>

            <div className="flex justify-center gap-1 mb-4">
              {Object.entries(rarityCount).map(([rarity, count]) =>
                count > 0 ? (
                  <div
                    key={rarity}
                    className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white bg-gradient-to-r ${RARITY[rarity].gradient}`}
                    title={rarity}
                  >
                    {count}
                  </div>
                ) : null
              )}
            </div>

            <div className="text-white/70 text-sm mb-4">
              Avg Cost: <span className="text-brass-300 font-bold">{avgCost} ⚡</span>
            </div>

            <div className="space-y-1 max-h-64 overflow-y-auto mb-4">
              <AnimatePresence>
                {deck.map((card) => (
                  <motion.div
                    key={card.deckId}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className={`flex items-center justify-between rounded-lg p-2 bg-night-700/60 border-l-4 ${RARITY[card.rarity].border} border-y border-r border-white/10`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-brass-300 font-bold w-5">{card.cost}</span>
                      <span className="text-white text-sm truncate max-w-[120px]">{card.name}</span>
                    </div>
                    <button onClick={() => removeFromDeck(card)} className="text-red-400 hover:text-red-300 text-lg px-1" aria-label={`Remove ${card.name} from deck`}>×</button>
                  </motion.div>
                ))}
              </AnimatePresence>

              {deck.length === 0 && (
                <div className="text-white/50 text-center py-6">Click cards to add</div>
              )}
            </div>

            <div className="space-y-2">
              <Button
                onClick={handleSaveDeck}
                disabled={deck.length !== DECK_SIZE}
                className={`w-full ${deck.length === DECK_SIZE ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-plush-700 cursor-not-allowed'}`}
              >
                {deck.length === DECK_SIZE ? 'Set as Current Deck' : `Need ${DECK_SIZE - deck.length} more`}
              </Button>
              <Button
                onClick={() => setShowSaveDialog(true)}
                disabled={deck.length !== DECK_SIZE}
                variant="outline"
                className="w-full text-white border-white/30"
              >
                Save As...
              </Button>
            </div>

            {savedDecks.length > 0 && (
              <div className="mt-6">
                <h3 className="text-white font-semibold mb-2">Saved Decks</h3>
                <div className="space-y-2">
                  {savedDecks.map((savedDeck) => (
                    <div key={savedDeck.name} className="flex items-center justify-between bg-white/5 rounded p-2">
                      <button onClick={() => loadSavedDeck(savedDeck)} className="text-white/80 hover:text-white text-sm flex-1 text-left">
                        📁 {savedDeck.name}
                      </button>
                      <button onClick={() => deleteDeck(savedDeck.name)} aria-label={`Delete deck ${savedDeck.name}`} className="text-red-400 hover:text-red-300 text-sm px-2">🗑️</button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <AnimatePresence>
        {showSaveDialog && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
            onClick={() => setShowSaveDialog(false)}
          >
            <motion.div
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.9 }}
              className="bg-night-700 border border-plush-700/60 rounded-xl p-6 max-w-sm w-full"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-white text-xl font-bold mb-4">Save Deck</h3>
              <input
                type="text"
                value={deckName}
                onChange={(e) => setDeckName(e.target.value)}
                placeholder="Enter deck name..."
                aria-label="Deck name"
                className="w-full bg-white/10 border border-white/20 text-white px-4 py-2 rounded-lg mb-4"
                maxLength={20}
                autoFocus
              />
              <div className="flex gap-2">
                <Button onClick={handleSaveDeck} disabled={!deckName.trim()} className="flex-1 bg-emerald-600 hover:bg-emerald-700">Save</Button>
                <Button onClick={() => setShowSaveDialog(false)} variant="outline" className="flex-1 text-white border-white/30">Cancel</Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default DeckBuilder;
