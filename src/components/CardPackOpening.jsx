import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from "@/components/ui/button";
import TeddyCard from './TeddyCard';
import { useGameStore } from '../stores/gameStore';
import confetti from 'canvas-confetti';
import { useDialog } from '@/hooks/useDialog';

import { RARITY, RARITY_ORDER } from '@/lib/rarity';

const CardPackOpening = ({ onClose }) => {
  const { cardPacks, premiumPacks, legendaryPacks, openCardPack, coins, gems, buyShopItem, getNextPackType } = useGameStore();
  const [isOpening, setIsOpening] = useState(false);
  const [pulledCards, setPulledCards] = useState(null);
  const [dupeCoins, setDupeCoins] = useState(0);
  const [revealedIndex, setRevealedIndex] = useState(-1);
  const [showPack, setShowPack] = useState(true);
  const [packAnimation, setPackAnimation] = useState(false);

  const totalPacks = cardPacks + premiumPacks + legendaryPacks;
  const nextPackType = getNextPackType();

  // Track the reveal-animation timers so closing the dialog mid-open cancels
  // them. Otherwise the pending 1.2s timer still fires openCardPack() after
  // unmount — silently consuming a pack with no reveal — and the reveal timers
  // burst confetti over whatever screen the player navigated to.
  const timeoutsRef = useRef([]);
  const track = (id) => { timeoutsRef.current.push(id); return id; };
  useEffect(() => {
    const timeouts = timeoutsRef.current;
    return () => timeouts.forEach(clearTimeout);
  }, []);

  const fireConfetti = (rarity) => {
    confetti({
      particleCount: rarity === 'legendary' ? 150 : rarity === 'epic' ? 100 : 50,
      spread: 70,
      origin: { y: 0.6 },
      colors: RARITY[rarity]?.hex || ['#FFFFFF'],
    });
  };

  const handleOpenPack = () => {
    if (totalPacks <= 0 || isOpening) return;

    setIsOpening(true);
    setPackAnimation(true);
    setPulledCards(null);
    setRevealedIndex(-1);

    track(setTimeout(() => {
      setShowPack(false);
      // Open the next available pack type (prioritizes legendary > premium > regular)
      const packType = getNextPackType();
      const result = openCardPack(packType);
      // The store claims the pack atomically; if none remain (e.g. a lost race),
      // it returns null — bail without crashing the reveal animation.
      if (!result) {
        setIsOpening(false);
        setShowPack(true);
        setPackAnimation(false);
        return;
      }
      const { cards, dupeCoins: refund } = result;
      setPulledCards(cards);
      setDupeCoins(refund);

      cards.forEach((card, index) => {
        track(setTimeout(() => {
          setRevealedIndex(index);
          if (card.rarity === 'legendary' || card.rarity === 'epic') {
            fireConfetti(card.rarity);
          } else if (card.rarity === 'rare' && card.isNew) {
            fireConfetti('rare');
          }
        }, 500 + index * 500));
      });

      track(setTimeout(() => {
        setIsOpening(false);
      }, 500 + cards.length * 500 + 500));
    }, 1200));
  };

  const handleBuyPack = (itemId) => {
    const result = buyShopItem(itemId);
    if (result.success) {
      fireConfetti('rare');
    }
  };

  const resetView = () => {
    setPulledCards(null);
    setDupeCoins(0);
    setRevealedIndex(-1);
    setShowPack(true);
    setPackAnimation(false);
  };

  const resetAndClose = () => {
    resetView();
    onClose();
  };

  const dialogRef = useDialog(resetAndClose);

  const newCardsCount = pulledCards ? pulledCards.filter(c => c.isNew).length : 0;

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-label="Card packs"
      className="fixed inset-0 z-50 bg-gradient-to-b from-night-950/95 to-night-800/95 flex items-center justify-center p-4 overflow-y-auto"
    >
      <div className="max-w-5xl w-full">
        {/* Header */}
        <div className="flex flex-wrap justify-between items-center mb-8 gap-4">
          <h1 className="text-3xl md:text-4xl font-display font-bold text-transparent bg-clip-text bg-gradient-to-r from-brass-300 to-brass-500">
            ✨ Card Packs
          </h1>
          <div className="flex items-center gap-3">
            <div className="bg-brass-400/15 px-4 py-2 rounded-lg flex items-center gap-2 border border-brass-400/30">
              <span className="text-brass-300">🪙</span>
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
        <div className="bg-night-800/60 backdrop-blur-sm rounded-2xl p-6 md:p-8 border border-plush-700/40 worn">
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
                        ? 'bg-gradient-to-br from-brass-500 via-brass-600 to-red-900 border-4 border-brass-300'
                        : nextPackType === 'premium'
                        ? 'bg-gradient-to-br from-sky-700 via-purple-800 to-indigo-900 border-4 border-sky-300'
                        : 'bg-gradient-to-br from-purple-800 via-fuchsia-900 to-night-800 border-4 border-brass-400'
                      }
                      shadow-2xl shadow-black/60
                      flex flex-col items-center justify-center
                      ${totalPacks > 0 && !isOpening ? 'hover:scale-105 transition-transform' : 'opacity-50'}
                    `}
                  >
                    <div className="text-7xl mb-4">{nextPackType === 'legendary' ? '⭐' : nextPackType === 'premium' ? '💎' : '📦'}</div>
                    <div className="text-white font-display font-bold text-2xl mb-1">
                      {nextPackType === 'legendary' ? 'Legendary Pack' : nextPackType === 'premium' ? 'Premium Pack' : 'Terrible Teddies'}
                    </div>
                    <div className={`text-sm font-semibold ${nextPackType === 'legendary' ? 'text-brass-200' : nextPackType === 'premium' ? 'text-sky-300' : 'text-brass-300'}`}>
                      {nextPackType === 'legendary' ? 'GUARANTEED LEGENDARY!' : nextPackType === 'premium' ? 'GUARANTEED RARE+' : 'CARD PACK'}
                    </div>
                    <div className="text-white/70 text-xs mt-2">{nextPackType === 'legendary' ? '10 Cards Inside' : '5 Cards Inside'}</div>
                    <div className="mt-4 flex gap-1">
                      {RARITY_ORDER.map((rarity) => (
                        <div
                          key={rarity}
                          className={`w-3 h-3 rounded-full bg-gradient-to-r ${RARITY[rarity].gradient}`}
                          title={rarity}
                        />
                      ))}
                    </div>
                  </motion.div>
                  <div className="absolute inset-0 rounded-2xl bg-brass-400/20 blur-2xl -z-10 animate-pulse" />
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
                              bg-gradient-to-r ${RARITY[card.rarity].gradient}
                              opacity-60
                            `} />
                            <div className={`${RARITY[card.rarity].glow} shadow-2xl`}>
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
                            className="w-24 h-36 bg-gradient-to-br from-night-700 to-night-800 rounded-lg border-2 border-plush-700 stitched-plush flex items-center justify-center"
                          >
                            <span className="text-3xl">?</span>
                          </motion.div>
                        )}
                      </motion.div>
                    ))}
                  </div>

                  {revealedIndex === pulledCards.length - 1 && (newCardsCount > 0 || dupeCoins > 0) && (
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="text-center font-bold text-lg space-y-1"
                    >
                      {newCardsCount > 0 && (
                        <div className="text-green-400">
                          🎉 {newCardsCount} new card{newCardsCount > 1 ? 's' : ''} added to collection!
                        </div>
                      )}
                      {dupeCoins > 0 && (
                        <div className="text-brass-300 text-base">
                          🪙 +{dupeCoins} coins for duplicate cards
                        </div>
                      )}
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
                    ? 'bg-gradient-to-r from-brass-400 to-brass-500 hover:from-brass-500 hover:to-brass-600'
                    : nextPackType === 'premium'
                    ? 'bg-gradient-to-r from-sky-600 to-purple-700 hover:from-sky-700 hover:to-purple-800'
                    : 'bg-gradient-to-r from-purple-700 to-fuchsia-800 hover:from-purple-800 hover:to-fuchsia-900'
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
                    className="bg-purple-700 hover:bg-purple-800 text-white px-6 py-3"
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
              <h3 className="text-white font-display font-bold text-xl mb-4 text-center">💰 Shop</h3>
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
              <span className="text-stone-300">Common 49%</span>
              <span className="text-emerald-300">Uncommon 30%</span>
              <span className="text-sky-300">Rare 15%</span>
              <span className="text-purple-300">Epic 5%</span>
              <span className="text-brass-300">Legendary 1%</span>
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
      <div className="absolute -top-2 -right-2 bg-gradient-to-r from-brass-400 to-brass-500 text-night-950 text-[9px] px-2 py-0.5 rounded-full font-bold">
        {badge}
      </div>
    )}
    <div className="text-3xl mb-1">{icon}</div>
    <div className="text-white text-sm font-bold">{name}</div>
    <div className="text-white/60 text-xs mb-2">{description}</div>
    <div className={`text-xs font-bold ${currency === 'coins' ? 'text-brass-300' : 'text-purple-300'}`}>
      {currency === 'coins' ? '🪙' : '💎'} {price}
    </div>
  </button>
);

export default CardPackOpening;
