import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from "@/components/ui/button";
import TeddyCard from './TeddyCard';
import { useGameStore } from '../stores/gameStore';
import confetti from 'canvas-confetti';

const RARITY_COLORS = {
  common: 'from-gray-400 to-gray-600',
  uncommon: 'from-green-400 to-green-600',
  rare: 'from-blue-400 to-blue-600',
  epic: 'from-purple-400 to-purple-600',
  legendary: 'from-yellow-400 to-orange-500',
};

const RARITY_GLOW = {
  common: 'shadow-gray-400/50',
  uncommon: 'shadow-green-400/50',
  rare: 'shadow-blue-400/50',
  epic: 'shadow-purple-400/50',
  legendary: 'shadow-yellow-400/80',
};

const CardPackOpening = ({ onClose }) => {
  const { cardPacks, premiumPacks, legendaryPacks, openCardPack, coins, gems, buyShopItem, getNextPackType } = useGameStore();
  const [isOpening, setIsOpening] = useState(false);
  const [pulledCards, setPulledCards] = useState(null);
  const [revealedIndex, setRevealedIndex] = useState(-1);
  const [showPack, setShowPack] = useState(true);
  const [packAnimation, setPackAnimation] = useState(false);

  const totalPacks = cardPacks + premiumPacks + legendaryPacks;
  const nextPackType = getNextPackType();

  const fireConfetti = (rarity) => {
    const colors = {
      legendary: ['#FFD700', '#FFA500', '#FF8C00'],
      epic: ['#9333EA', '#A855F7', '#C084FC'],
      rare: ['#3B82F6', '#60A5FA', '#93C5FD'],
    };
    confetti({
      particleCount: rarity === 'legendary' ? 150 : rarity === 'epic' ? 100 : 50,
      spread: 70,
      origin: { y: 0.6 },
      colors: colors[rarity] || ['#FFFFFF'],
    });
  };

  const handleOpenPack = () => {
    if (totalPacks <= 0) return;

    setIsOpening(true);
    setPackAnimation(true);
    setPulledCards(null);
    setRevealedIndex(-1);

    setTimeout(() => {
      setShowPack(false);
      // Open the next available pack type (prioritizes legendary > premium > regular)
      const packType = getNextPackType();
      const cards = openCardPack(packType);
      setPulledCards(cards);

      cards.forEach((card, index) => {
        setTimeout(() => {
          setRevealedIndex(index);
          if (card.rarity === 'legendary' || card.rarity === 'epic') {
            fireConfetti(card.rarity);
          } else if (card.rarity === 'rare' && card.isNew) {
            fireConfetti('rare');
          }
        }, 500 + index * 500);
      });

      setTimeout(() => {
        setIsOpening(false);
      }, 500 + cards.length * 500 + 500);
    }, 1200);
  };

  const handleBuyPack = (itemId) => {
    const result = buyShopItem(itemId);
    if (result.success) {
      fireConfetti('rare');
    }
  };

  const resetView = () => {
    setPulledCards(null);
    setRevealedIndex(-1);
    setShowPack(true);
    setPackAnimation(false);
  };

  const resetAndClose = () => {
    resetView();
    onClose();
  };

  const newCardsCount = pulledCards ? pulledCards.filter(c => c.isNew).length : 0;

  return (
    <div className="fixed inset-0 z-50 bg-gradient-to-b from-black/95 to-purple-900/95 flex items-center justify-center p-4 overflow-y-auto">
      <div className="max-w-5xl w-full">
        {/* Header */}
        <div className="flex flex-wrap justify-between items-center mb-8 gap-4">
          <h1 className="text-3xl md:text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-400">
            ✨ Card Packs
          </h1>
          <div className="flex items-center gap-3">
            <div className="bg-yellow-500/20 px-4 py-2 rounded-lg flex items-center gap-2 border border-yellow-500/30">
              <span className="text-yellow-400">🪙</span>
              <span className="text-white font-bold">{coins.toLocaleString()}</span>
            </div>
            <div className="bg-purple-500/20 px-4 py-2 rounded-lg flex items-center gap-2 border border-purple-500/30">
              <span className="text-purple-400">💎</span>
              <span className="text-white font-bold">{gems}</span>
            </div>
            <div className="bg-pink-500/20 px-4 py-2 rounded-lg flex items-center gap-2 border border-pink-500/30">
              <span className="text-pink-400">📦</span>
              <span className="text-white font-bold">{totalPacks}</span>
              {(premiumPacks > 0 || legendaryPacks > 0) && (
                <span className="text-xs text-white/60">
                  ({cardPacks}+{premiumPacks}P+{legendaryPacks}L)
                </span>
              )}
            </div>
            <button
              onClick={resetAndClose}
              className="text-white/70 hover:text-white text-3xl ml-2"
              aria-label="Close card packs"
            >
              ×
            </button>
          </div>
        </div>

        {/* Main content */}
        <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-6 md:p-8 border border-white/10">
          {/* Pack display / Card reveal */}
          <div className="flex flex-col items-center justify-center min-h-[350px]">
            <AnimatePresence mode="wait">
              {!pulledCards && showPack && (
                <motion.div
                  key="pack"
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={packAnimation ? {
                    scale: [1, 1.1, 1.2, 0],
                    rotate: [0, -5, 5, 0],
                    opacity: [1, 1, 1, 0],
                  } : { scale: 1, opacity: 1 }}
                  transition={{ duration: packAnimation ? 1.2 : 0.5 }}
                  className="relative cursor-pointer"
                  onClick={totalPacks > 0 && !isOpening ? handleOpenPack : undefined}
                >
                  <motion.div
                    animate={!packAnimation ? {
                      y: [0, -10, 0],
                      rotate: [-2, 2, -2],
                    } : {}}
                    transition={{ repeat: Infinity, duration: 3 }}
                    className={`
                      w-56 h-72 rounded-2xl
                      ${nextPackType === 'legendary'
                        ? 'bg-gradient-to-br from-yellow-500 via-orange-600 to-red-700 border-4 border-yellow-300'
                        : nextPackType === 'premium'
                        ? 'bg-gradient-to-br from-blue-500 via-purple-600 to-indigo-700 border-4 border-blue-300'
                        : 'bg-gradient-to-br from-purple-600 via-pink-600 to-indigo-700 border-4 border-yellow-400'
                      }
                      shadow-2xl shadow-purple-500/50
                      flex flex-col items-center justify-center
                      ${totalPacks > 0 && !isOpening ? 'hover:scale-105 transition-transform' : 'opacity-50'}
                    `}
                  >
                    <div className="text-7xl mb-4">{nextPackType === 'legendary' ? '⭐' : nextPackType === 'premium' ? '💎' : '📦'}</div>
                    <div className="text-white font-bold text-2xl mb-1">
                      {nextPackType === 'legendary' ? 'Legendary Pack' : nextPackType === 'premium' ? 'Premium Pack' : 'Terrible Teddies'}
                    </div>
                    <div className={`text-sm font-semibold ${nextPackType === 'legendary' ? 'text-yellow-300' : nextPackType === 'premium' ? 'text-blue-300' : 'text-yellow-300'}`}>
                      {nextPackType === 'legendary' ? 'GUARANTEED LEGENDARY!' : nextPackType === 'premium' ? 'GUARANTEED RARE+' : 'CARD PACK'}
                    </div>
                    <div className="text-white/70 text-xs mt-2">{nextPackType === 'legendary' ? '10 Cards Inside' : '5 Cards Inside'}</div>
                    <div className="mt-4 flex gap-1">
                      {Object.keys(RARITY_COLORS).map((rarity) => (
                        <div
                          key={rarity}
                          className={`w-3 h-3 rounded-full bg-gradient-to-r ${RARITY_COLORS[rarity]}`}
                          title={rarity}
                        />
                      ))}
                    </div>
                  </motion.div>
                  <div className="absolute inset-0 rounded-2xl bg-purple-500/30 blur-2xl -z-10 animate-pulse" />
                </motion.div>
              )}

              {pulledCards && (
                <motion.div
                  key="cards"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="w-full"
                >
                  <div className="flex flex-wrap justify-center gap-4 mb-6">
                    {pulledCards.map((card, index) => (
                      <motion.div
                        key={`${card.id}-${index}`}
                        initial={{ scale: 0, rotateY: 180, y: 100 }}
                        animate={index <= revealedIndex ? {
                          scale: 1,
                          rotateY: 0,
                          y: 0,
                          transition: { type: 'spring', stiffness: 200, damping: 15 }
                        } : { scale: 0.8, rotateY: 180 }}
                        className="relative"
                      >
                        {index <= revealedIndex ? (
                          <>
                            <div className={`
                              absolute inset-0 rounded-lg blur-xl -z-10
                              bg-gradient-to-r ${RARITY_COLORS[card.rarity]}
                              opacity-60
                            `} />
                            <div className={`${RARITY_GLOW[card.rarity]} shadow-2xl`}>
                              <TeddyCard teddy={card} />
                            </div>
                            {card.isNew && (
                              <motion.div
                                initial={{ scale: 0 }}
                                animate={{ scale: [0, 1.3, 1] }}
                                className="absolute -top-3 -right-3 bg-gradient-to-r from-green-500 to-emerald-500 text-white text-xs px-2 py-1 rounded-full font-bold shadow-lg"
                              >
                                ✨ NEW
                              </motion.div>
                            )}
                            {card.rarity === 'legendary' && (
                              <motion.div
                                animate={{ rotate: 360 }}
                                transition={{ repeat: Infinity, duration: 3, ease: 'linear' }}
                                className="absolute -top-4 left-1/2 -translate-x-1/2 text-2xl"
                              >
                                ⭐
                              </motion.div>
                            )}
                          </>
                        ) : (
                          <motion.div
                            animate={{ rotateY: [180, 180] }}
                            className="w-24 h-36 bg-gradient-to-br from-purple-800 to-indigo-800 rounded-lg border-2 border-purple-500 flex items-center justify-center"
                          >
                            <span className="text-3xl">?</span>
                          </motion.div>
                        )}
                      </motion.div>
                    ))}
                  </div>

                  {revealedIndex === pulledCards.length - 1 && newCardsCount > 0 && (
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="text-center text-green-400 font-bold text-lg"
                    >
                      🎉 {newCardsCount} new card{newCardsCount > 1 ? 's' : ''} added to collection!
                    </motion.div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Actions */}
          <div className="flex flex-wrap justify-center gap-3 mt-8">
            {!pulledCards && !isOpening && totalPacks > 0 && (
              <Button
                onClick={handleOpenPack}
                className={`text-white px-8 py-3 text-lg font-bold shadow-lg ${
                  nextPackType === 'legendary'
                    ? 'bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600'
                    : nextPackType === 'premium'
                    ? 'bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600'
                    : 'bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600'
                }`}
              >
                🎁 Open {nextPackType === 'legendary' ? 'Legendary' : nextPackType === 'premium' ? 'Premium' : ''} Pack ({totalPacks})
              </Button>
            )}

            {!pulledCards && !isOpening && totalPacks === 0 && (
              <div className="text-center">
                <p className="text-white/70 mb-3">No packs available. Buy some below!</p>
              </div>
            )}

            {pulledCards && !isOpening && (
              <>
                {totalPacks > 0 && (
                  <Button
                    onClick={() => { resetView(); handleOpenPack(); }}
                    className="bg-purple-500 hover:bg-purple-600 text-white px-6 py-3"
                  >
                    Open Another ({totalPacks})
                  </Button>
                )}
                <Button
                  onClick={resetAndClose}
                  variant="outline"
                  className="border-white/30 text-white hover:bg-white/10 px-6 py-3"
                >
                  Done
                </Button>
              </>
            )}
          </div>

          {/* Shop */}
          {!pulledCards && !isOpening && (
            <div className="mt-10 pt-6 border-t border-white/10">
              <h3 className="text-white font-bold text-xl mb-4 text-center">💰 Shop</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <ShopItem
                  icon="📦"
                  name="Card Pack"
                  description="5 cards"
                  price={200}
                  currency="coins"
                  canAfford={coins >= 200}
                  onClick={() => handleBuyPack('pack_1')}
                />
                <ShopItem
                  icon="📦"
                  name="5 Packs"
                  description="25 cards (-10%)"
                  price={900}
                  currency="coins"
                  canAfford={coins >= 900}
                  onClick={() => handleBuyPack('pack_5')}
                  badge="BEST VALUE"
                />
                <ShopItem
                  icon="📦📦"
                  name="10 Packs"
                  description="50 cards (-20%)"
                  price={1600}
                  currency="coins"
                  canAfford={coins >= 1600}
                  onClick={() => handleBuyPack('pack_10')}
                />
                <ShopItem
                  icon="💎"
                  name="Premium Pack"
                  description="Guaranteed rare+"
                  price={50}
                  currency="gems"
                  canAfford={gems >= 50}
                  onClick={() => handleBuyPack('premium_pack')}
                />
                <ShopItem
                  icon="⭐"
                  name="Legendary Pack"
                  description="10 cards, 1 legendary!"
                  price={200}
                  currency="gems"
                  canAfford={gems >= 200}
                  onClick={() => handleBuyPack('legendary_pack')}
                  badge="PREMIUM"
                />
                <ShopItem
                  icon="🪙"
                  name="Coin Bag"
                  description="+500 coins"
                  price={10}
                  currency="gems"
                  canAfford={gems >= 10}
                  onClick={() => handleBuyPack('coins_small')}
                />
              </div>
            </div>
          )}

          {/* Rarity guide */}
          <div className="mt-6 text-center">
            <div className="text-white/50 text-xs mb-1">Drop Rates</div>
            <div className="flex justify-center flex-wrap gap-3 text-xs">
              <span className="text-gray-400">Common 49%</span>
              <span className="text-green-400">Uncommon 30%</span>
              <span className="text-blue-400">Rare 15%</span>
              <span className="text-purple-400">Epic 5%</span>
              <span className="text-yellow-400">Legendary 1%</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const ShopItem = ({ icon, name, description, price, currency, canAfford, onClick, badge }) => (
  <button
    onClick={onClick}
    disabled={!canAfford}
    className={`
      relative p-3 rounded-lg border transition-all
      ${canAfford
        ? 'bg-white/10 border-white/30 hover:bg-white/20 hover:border-white/50 hover:scale-105'
        : 'bg-white/5 border-white/10 opacity-50 cursor-not-allowed'
      }
    `}
  >
    {badge && (
      <div className="absolute -top-2 -right-2 bg-gradient-to-r from-yellow-500 to-orange-500 text-white text-[9px] px-2 py-0.5 rounded-full font-bold">
        {badge}
      </div>
    )}
    <div className="text-3xl mb-1">{icon}</div>
    <div className="text-white text-sm font-bold">{name}</div>
    <div className="text-white/60 text-xs mb-2">{description}</div>
    <div className={`text-xs font-bold ${currency === 'coins' ? 'text-yellow-400' : 'text-purple-400'}`}>
      {currency === 'coins' ? '🪙' : '💎'} {price}
    </div>
  </button>
);

export default CardPackOpening;
