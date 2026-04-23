import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from "@/components/ui/button";
import TeddyCard from './TeddyCard';
import { useGameStore, ALL_CARDS } from '../stores/gameStore';

const RARITY_COLORS = {
  common: 'from-gray-400 to-gray-600',
  uncommon: 'from-green-400 to-green-600',
  rare: 'from-blue-400 to-blue-600',
  epic: 'from-purple-400 to-purple-600',
  legendary: 'from-yellow-400 to-orange-500',
};

const RARITY_ORDER = ['legendary', 'epic', 'rare', 'uncommon', 'common'];

const TeddyCollection = () => {
  const { ownedCards } = useGameStore();
  const [selectedCard, setSelectedCard] = useState(null);
  const [filter, setFilter] = useState('all');
  const [rarityFilter, setRarityFilter] = useState('all');
  const [showOwned, setShowOwned] = useState(true);

  const allCardsWithOwnership = ALL_CARDS.map(card => ({
    ...card,
    owned: ownedCards.includes(card.id),
  }));

  const filteredCards = allCardsWithOwnership.filter(card => {
    if (showOwned && !card.owned) return false;
    if (!showOwned && card.owned) return false;
    if (filter !== 'all' && card.type !== filter) return false;
    if (rarityFilter !== 'all' && card.rarity !== rarityFilter) return false;
    return true;
  });

  const sortedCards = [...filteredCards].sort((a, b) => {
    return RARITY_ORDER.indexOf(a.rarity) - RARITY_ORDER.indexOf(b.rarity);
  });

  const totalOwned = ownedCards.length;
  const totalCards = ALL_CARDS.length;
  const completionPercent = ((totalOwned / totalCards) * 100).toFixed(1);

  const rarityStats = RARITY_ORDER.map(rarity => {
    const total = ALL_CARDS.filter(c => c.rarity === rarity).length;
    const owned = allCardsWithOwnership.filter(c => c.rarity === rarity && c.owned).length;
    return { rarity, total, owned };
  });

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-6 text-center">
        <h1 className="text-4xl font-bold text-white mb-4">Card Collection</h1>
        <div className="flex justify-center items-center gap-6 mb-4 flex-wrap">
          <div className="bg-white/10 px-4 py-2 rounded-xl">
            <div className="text-2xl font-bold text-white">{totalOwned} / {totalCards}</div>
            <div className="text-white/50 text-xs">Collected</div>
          </div>
          <div className="bg-white/10 px-4 py-2 rounded-xl">
            <div className="text-2xl font-bold text-yellow-400">{completionPercent}%</div>
            <div className="text-white/50 text-xs">Complete</div>
          </div>
        </div>

        <div className="flex justify-center gap-3 mb-4 flex-wrap">
          {rarityStats.map(({ rarity, total, owned }) => (
            <div key={rarity} className="text-center">
              <div className={`w-12 h-12 rounded-full mx-auto mb-1 flex items-center justify-center bg-gradient-to-br ${RARITY_COLORS[rarity]} border-2 border-white/20`}>
                <span className="text-white font-bold text-xs">{owned}/{total}</span>
              </div>
              <div className="text-white/50 text-xs capitalize">{rarity}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap justify-center gap-3 mb-6">
        <div className="flex bg-white/10 rounded-lg overflow-hidden">
          <button
            onClick={() => setShowOwned(true)}
            className={`px-4 py-2 text-sm font-semibold transition-colors ${showOwned ? 'bg-green-500 text-white' : 'text-white/70 hover:text-white'}`}
          >
            Owned ({totalOwned})
          </button>
          <button
            onClick={() => setShowOwned(false)}
            className={`px-4 py-2 text-sm font-semibold transition-colors ${!showOwned ? 'bg-gray-500 text-white' : 'text-white/70 hover:text-white'}`}
          >
            Missing ({totalCards - totalOwned})
          </button>
        </div>

        <div className="flex gap-1">
          {['all', 'action', 'trap', 'special'].map(type => (
            <button
              key={type}
              onClick={() => setFilter(type)}
              className={`px-3 py-2 rounded-lg text-sm font-semibold transition-all ${
                filter === type ? 'bg-white text-purple-900' : 'bg-white/10 text-white/70 hover:bg-white/20'
              }`}
            >
              {type === 'all' ? 'All' : type.charAt(0).toUpperCase() + type.slice(1)}
            </button>
          ))}
        </div>

        <div className="flex gap-1">
          {['all', ...RARITY_ORDER].map(rarity => (
            <button
              key={rarity}
              onClick={() => setRarityFilter(rarity)}
              className={`px-3 py-2 rounded-lg text-sm font-semibold transition-all capitalize ${
                rarityFilter === rarity
                  ? rarity === 'all'
                    ? 'bg-white text-purple-900'
                    : `bg-gradient-to-r ${RARITY_COLORS[rarity]} text-white`
                  : 'bg-white/10 text-white/70 hover:bg-white/20'
              }`}
            >
              {rarity}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-3 md:grid-cols-5 lg:grid-cols-7 gap-4 mb-8">
        <AnimatePresence>
          {sortedCards.map((card, index) => (
            <motion.div
              key={card.id}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={{ delay: Math.min(index * 0.02, 0.5) }}
              onClick={() => setSelectedCard(card)}
              className={`cursor-pointer relative ${!card.owned ? 'opacity-40' : ''}`}
            >
              <div className={`absolute inset-0 rounded-lg blur-lg -z-10 opacity-40 bg-gradient-to-r ${RARITY_COLORS[card.rarity]}`} />
              <TeddyCard teddy={card} />
              {!card.owned && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-lg">
                  <span className="text-2xl">🔒</span>
                </div>
              )}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {sortedCards.length === 0 && (
        <div className="text-center text-white/50 py-12">No cards match your filters.</div>
      )}

      <AnimatePresence>
        {selectedCard && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
            onClick={() => setSelectedCard(null)}
          >
            <motion.div
              initial={{ scale: 0.8 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.8 }}
              className="bg-gradient-to-b from-gray-800 to-gray-900 rounded-2xl p-6 max-w-md w-full border-4"
              style={{
                borderColor: {
                  common: '#9CA3AF', uncommon: '#22C55E', rare: '#3B82F6', epic: '#A855F7', legendary: '#F59E0B',
                }[selectedCard.rarity],
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex gap-6">
                <div className="relative">
                  <div className={`absolute inset-0 rounded-lg blur-xl -z-10 bg-gradient-to-r ${RARITY_COLORS[selectedCard.rarity]}`} />
                  <TeddyCard teddy={selectedCard} />
                </div>

                <div className="flex-1">
                  <div className={`inline-block px-2 py-1 rounded text-xs font-bold uppercase mb-2 bg-gradient-to-r ${RARITY_COLORS[selectedCard.rarity]} text-white`}>
                    {selectedCard.rarity}
                  </div>
                  <h2 className="text-2xl font-bold text-white mb-2">{selectedCard.name}</h2>
                  <p className="text-white/70 text-sm mb-4">{selectedCard.description}</p>

                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between"><span className="text-white/50">Type</span><span className="text-white capitalize">{selectedCard.type}</span></div>
                    <div className="flex justify-between"><span className="text-white/50">Cost</span><span className="text-yellow-400">{selectedCard.cost} ⚡</span></div>
                    {selectedCard.type === 'action' && (
                      <>
                        <div className="flex justify-between"><span className="text-white/50">Attack</span><span className="text-red-400">{selectedCard.attack}</span></div>
                        <div className="flex justify-between"><span className="text-white/50">Defense</span><span className="text-blue-400">{selectedCard.defense}</span></div>
                      </>
                    )}
                    {selectedCard.ability && selectedCard.ability !== 'none' && (
                      <div className="flex justify-between"><span className="text-white/50">Ability</span><span className="text-purple-400 capitalize">{selectedCard.ability}</span></div>
                    )}
                    {selectedCard.effect && (
                      <div className="flex justify-between"><span className="text-white/50">Effect</span><span className="text-cyan-400 capitalize">{selectedCard.effect} {selectedCard.amount}</span></div>
                    )}
                  </div>

                  {!selectedCard.owned && (
                    <div className="mt-4 bg-red-500/20 border border-red-500 rounded-lg p-3 text-center">
                      <span className="text-red-400 text-sm">🔒 Not yet collected</span>
                    </div>
                  )}
                </div>
              </div>

              <Button onClick={() => setSelectedCard(null)} className="w-full mt-6 bg-white/10 hover:bg-white/20">Close</Button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default TeddyCollection;
