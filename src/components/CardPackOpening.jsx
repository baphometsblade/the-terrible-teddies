import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Package, PackageOpen, Gem, Crown, Coins, X, Sparkles, PartyPopper } from 'lucide-react';
import TeddyCard, { CardBack } from './TeddyCard';
import { useGameStore } from '../stores/gameStore';
import confetti from 'canvas-confetti';
import { useDialog } from '@/hooks/useDialog';

import { RARITY, RARITY_ORDER, RARITY_METAL } from '@/lib/rarity';

// Plain <button>s rather than the shadcn Button: its bg-primary is a utility
// and would beat the component-layer btn-brass / btn-glass materials.
const FOCUS =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass-300 ' +
  'focus-visible:ring-offset-2 focus-visible:ring-offset-night-900';
const ACTION = `inline-flex items-center justify-center gap-2 h-11 rounded-xl font-display font-bold whitespace-nowrap ${FOCUS}`;

// One look per pack tier, shared with the Shop's pack tiles: a metal frame from
// the rarity ladder over a tinted face, with a foil sweep (index.css .foil,
// CSS-only and off when Animations are). `glow` is the light the pack sits in.
const PACK_LOOK = {
  regular: {
    metal: RARITY_METAL.common,
    face: 'linear-gradient(165deg, #4b2a72 0%, #2b1845 55%, #170d25 100%)',
    Icon: Package,
    tone: 'text-brass-300',
    tagTone: 'text-brass-300',
    foil: 'foil',
    glow: 'rgba(251, 191, 36, 0.28)',
    light: 'rgba(251, 191, 36, 0.14)',
  },
  premium: {
    metal: RARITY_METAL.epic,
    face: 'linear-gradient(165deg, #6d28d9 0%, #3b0f6b 55%, #1a0b30 100%)',
    Icon: Gem,
    tone: 'text-fuchsia-200',
    tagTone: 'text-sky-300',
    foil: 'foil foil-epic',
    glow: 'rgba(192, 132, 252, 0.4)',
    light: 'rgba(192, 132, 252, 0.18)',
  },
  legendary: {
    metal: RARITY_METAL.legendary,
    face: 'linear-gradient(165deg, #92400e 0%, #7c2d12 45%, #3b1508 100%)',
    Icon: Crown,
    tone: 'text-brass-200',
    tagTone: 'text-brass-200',
    foil: 'foil',
    glow: 'rgba(251, 191, 36, 0.5)',
    light: 'rgba(251, 191, 36, 0.24)',
  },
};

// The crimped seal along the top and bottom of a foil pack.
const CRIMP = 'bg-[repeating-linear-gradient(90deg,rgba(255,255,255,0.2)_0_1px,rgba(0,0,0,0.25)_1px_3px)]';

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

  const look = PACK_LOOK[nextPackType] || PACK_LOOK.regular;
  const tierName = nextPackType === 'legendary' ? 'Legendary' : nextPackType === 'premium' ? 'Premium' : '';
  const canOpen = totalPacks > 0 && !isOpening;

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-label="Card packs"
      // Scrolls, and the panel is pinned to the top rather than centred: the
      // shop below the table goes away while a pack opens, and a centred panel
      // would jump down the screen under the player the moment they tap Open.
      className="fixed inset-0 z-50 dialog-scrim flex items-start justify-center p-3 sm:p-6 overflow-y-auto"
    >
      <div className="relative w-full max-w-5xl rounded-2xl dialog-panel overflow-hidden">
        {/* Header. On a phone the balances drop to their own row under the
            title and the close control. */}
        <div className="relative flex flex-wrap items-center gap-3 px-3 sm:px-6 pt-4 sm:pt-5 pb-4">
          <div className="flex items-center gap-3 min-w-0 mr-auto">
            <div aria-hidden="true" className="w-11 h-11 shrink-0 rounded-full p-[2px]" style={{ background: RARITY_METAL.legendary }}>
              <div className="grid place-items-center w-full h-full rounded-full bg-night-900">
                <Package className="w-5 h-5 text-brass-300" strokeWidth={2} />
              </div>
            </div>
            <h1 className="font-display text-3xl md:text-4xl font-extrabold leading-none text-brass-gradient">
              Card Packs
            </h1>
          </div>
          <div className="order-last w-full sm:order-none sm:w-auto flex flex-wrap items-center gap-2">
            <Balance icon={Coins} tone="text-brass-300" noun="coins">{coins.toLocaleString()}</Balance>
            <Balance icon={Gem} tone="text-fuchsia-300" noun="gems">{gems.toLocaleString()}</Balance>
            <Balance icon={Package} tone="text-sky-300" noun="packs to open">
              {totalPacks}
              {(premiumPacks > 0 || legendaryPacks > 0) && (
                <span className="ml-1 font-sans text-xs font-semibold text-plush-300">
                  ({cardPacks}+{premiumPacks}P+{legendaryPacks}L)
                </span>
              )}
            </Balance>
          </div>
          <button
            type="button"
            onClick={resetAndClose}
            className={`btn-glass grid place-items-center w-10 h-10 shrink-0 rounded-xl ${FOCUS}`}
            aria-label="Close card packs"
          >
            <X aria-hidden="true" className="w-5 h-5" strokeWidth={2.4} />
          </button>
        </div>

        <div className="relative px-3 sm:px-6 pb-5 sm:pb-6">
          {/* The stage: a lit display case the pack sits in and the cards are
              dealt onto. Isolated so the pack's glow can sit behind it. */}
          <div className="relative isolate overflow-hidden rounded-2xl border border-white/5 bg-night-950/55 shadow-[inset_0_2px_24px_rgba(0,0,0,0.65)] px-3 py-6 sm:p-8">
            <div
              aria-hidden="true"
              className="absolute inset-0 -z-10 transition-[background] duration-500"
              style={{ background: `radial-gradient(ellipse 60% 70% at 50% 0%, ${look.light}, transparent 70%)` }}
            />

            {/* Pack display / Card reveal */}
            <div className="flex flex-col items-center justify-center min-h-[300px]">
              <AnimatePresence mode="wait">
                {!pulledCards && showPack && (
                  <motion.div
                    key="pack"
                    initial={{ scale: 0.85, opacity: 0 }}
                    // The tear: the pack strains (a shiver that builds), swells,
                    // and goes in a flash of light. One-shot keyframes on
                    // transform/opacity only.
                    animate={packAnimation ? {
                      rotate: [0, -2, 2, -4, 4, -6, 6, 0],
                      scale: [1, 1.01, 1.02, 1.03, 1.05, 1.07, 1.1, 1.35],
                      opacity: [1, 1, 1, 1, 1, 1, 1, 0],
                    } : { scale: 1, opacity: 1 }}
                    transition={packAnimation
                      ? { duration: 1.2, ease: 'easeInOut' }
                      : { duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                    className={`relative isolate ${canOpen ? 'cursor-pointer' : ''}`}
                    onClick={canOpen ? handleOpenPack : undefined}
                  >
                    <div
                      aria-hidden="true"
                      className="absolute -inset-8 -z-10 rounded-[3rem] blur-2xl motion-safe:animate-pulse [[data-motion=off]_&]:animate-none"
                      style={{ background: `radial-gradient(ellipse at center, ${look.glow}, transparent 70%)` }}
                    />
                    <div className={`transition-transform duration-300 ${canOpen ? 'hover:-translate-y-1.5' : ''} ${totalPacks === 0 ? 'opacity-50 saturate-50' : ''}`}>
                      <HeroPack look={look} nextPackType={nextPackType} />
                    </div>
                    {/* The flash as it tears. Centred by the plain wrapper; the
                        motion layer animates only scale and opacity. */}
                    <div aria-hidden="true" className="pointer-events-none absolute inset-0 grid place-items-center">
                      <motion.div
                        initial={{ opacity: 0, scale: 0.3 }}
                        animate={packAnimation ? { opacity: [0, 0, 1, 0.7], scale: [0.3, 0.3, 1.15, 1.7] } : { opacity: 0, scale: 0.3 }}
                        transition={{ duration: 1.2, times: [0, 0.6, 0.9, 1] }}
                        className="w-96 h-96 rounded-full"
                        style={{ background: 'radial-gradient(circle, rgba(255,251,235,0.95) 0%, rgba(253,230,138,0.55) 28%, rgba(251,191,36,0.15) 50%, transparent 70%)' }}
                      />
                    </div>
                  </motion.div>
                )}

                {pulledCards && (
                  <motion.div
                    key="cards"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="w-full"
                  >
                    {/* zoom, not transform, so the bigger cards take the room
                        they appear to and the row still wraps honestly. Five
                        across on a wide screen; a ten-card pack is two rows. */}
                    <div className={`mx-auto flex flex-wrap justify-center gap-x-3 gap-y-4 md:gap-x-4 md:max-w-[552px] ${
                      pulledCards.length > 5 ? 'md:[zoom:1.15]' : 'md:[zoom:1.4]'
                    }`}>
                      {pulledCards.map((card, index) => (
                        <RevealCard
                          key={`${card.id}-${index}`}
                          card={card}
                          index={index}
                          revealed={index <= revealedIndex}
                        />
                      ))}
                    </div>

                    {revealedIndex === pulledCards.length - 1 && (newCardsCount > 0 || dupeCoins > 0) && (
                      <motion.div
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="mt-7 flex flex-wrap justify-center gap-2.5"
                      >
                        {newCardsCount > 0 && (
                          <div className="panel-glass rounded-xl px-4 py-2.5 inline-flex items-center gap-2 font-display font-bold text-emerald-300">
                            <PartyPopper aria-hidden="true" className="w-5 h-5 shrink-0" strokeWidth={2.2} />
                            <span>{newCardsCount} new card{newCardsCount > 1 ? 's' : ''} added to collection!</span>
                          </div>
                        )}
                        {dupeCoins > 0 && (
                          <div className="panel-glass rounded-xl px-4 py-2.5 inline-flex items-center gap-2 font-display font-bold text-brass-300">
                            <Coins aria-hidden="true" className="w-5 h-5 shrink-0" strokeWidth={2.2} />
                            <span>+{dupeCoins} coins for duplicate cards</span>
                          </div>
                        )}
                      </motion.div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Actions */}
            <div className="flex flex-wrap justify-center gap-3 mt-7 min-h-11">
              {!pulledCards && !isOpening && totalPacks > 0 && (
                <button type="button" onClick={handleOpenPack} className={`${ACTION} btn-brass sheen relative px-8 text-lg`}>
                  <PackageOpen aria-hidden="true" className="w-5 h-5" strokeWidth={2.2} />
                  {`Open ${tierName ? `${tierName} ` : ''}Pack (${totalPacks})`}
                </button>
              )}

              {!pulledCards && !isOpening && totalPacks === 0 && (
                <div className="text-center">
                  <p className="text-plush-200">No packs available. Buy some below!</p>
                </div>
              )}

              {pulledCards && !isOpening && (
                <>
                  {totalPacks > 0 && (
                    <button
                      type="button"
                      onClick={() => { resetView(); handleOpenPack(); }}
                      className={`${ACTION} btn-brass px-6 text-base`}
                    >
                      <PackageOpen aria-hidden="true" className="w-5 h-5" strokeWidth={2.2} />
                      Open Another ({totalPacks})
                    </button>
                  )}
                  <button type="button" onClick={resetAndClose} className={`${ACTION} btn-glass sm:min-w-[7rem] px-6 text-base`}>
                    Done
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Shop */}
          {!pulledCards && !isOpening && (
            <div className="mt-6">
              <div className="flex items-center gap-3 mb-3">
                <h3 className="label-caps text-plush-300 shrink-0">Shop</h3>
                <span aria-hidden="true" className="h-px flex-1 bg-gradient-to-r from-white/10 to-transparent" />
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 sm:gap-3">
                <ShopItem
                  tier="regular"
                  quantity={1}
                  name="Card Pack"
                  description="5 cards"
                  price={200}
                  currency="coins"
                  canAfford={coins >= 200}
                  onClick={() => handleBuyPack('pack_1')}
                />
                <ShopItem
                  tier="regular"
                  quantity={5}
                  name="5 Packs"
                  description="25 cards (-10%)"
                  price={900}
                  currency="coins"
                  canAfford={coins >= 900}
                  onClick={() => handleBuyPack('pack_5')}
                />
                <ShopItem
                  tier="regular"
                  quantity={10}
                  name="10 Packs"
                  description="50 cards (-20%)"
                  price={1600}
                  currency="coins"
                  canAfford={coins >= 1600}
                  onClick={() => handleBuyPack('pack_10')}
                  badge="BEST VALUE"
                />
                <ShopItem
                  tier="premium"
                  quantity={1}
                  name="Premium Pack"
                  description="Guaranteed rare+"
                  price={50}
                  currency="gems"
                  canAfford={gems >= 50}
                  onClick={() => handleBuyPack('premium_pack')}
                />
                <ShopItem
                  tier="legendary"
                  quantity={1}
                  name="Legendary Pack"
                  description="10 cards, 1 legendary!"
                  price={200}
                  currency="gems"
                  canAfford={gems >= 200}
                  onClick={() => handleBuyPack('legendary_pack')}
                  badge="PREMIUM"
                />
                <ShopItem
                  tier="coins"
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

          {/* Rarity guide.
              Scoped on purpose: these are the odds for an ordinary card slot
              only. A Premium pack's first card rolls 75% rare / 20% epic / 5%
              legendary, and a Legendary pack's first card is legendary
              outright — that IS the guarantee those tiers are sold on. Posting
              the base table unqualified, right beside the gem-priced tiles,
              understated exactly what the player was paying for. */}
          <div className="mt-6 text-center">
            <div className="label-caps tracking-[0.1em] sm:tracking-[0.16em] text-plush-300 mb-2">Drop Rates — per card, standard packs</div>
            <div className="flex justify-center flex-wrap gap-x-4 gap-y-1.5 text-xs font-semibold">
              <Rate rarity="common" tone="text-stone-300">Common 49%</Rate>
              <Rate rarity="uncommon" tone="text-emerald-300">Uncommon 30%</Rate>
              <Rate rarity="rare" tone="text-sky-300">Rare 15%</Rate>
              <Rate rarity="epic" tone="text-purple-300">Epic 5%</Rate>
              <Rate rarity="legendary" tone="text-brass-300">Legendary 1%</Rate>
            </div>
            <div className="text-plush-400 text-[11px] mt-2">
              Premium and Legendary packs roll their first card on better odds.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// The icon carries the meaning visually; the sr-only noun carries it for a
// screen reader. (aria-label on a role-less div is prohibited in ARIA 1.2.)
const Balance = ({ icon: Icon, tone, noun, children }) => (
  <div className="panel-glass rounded-xl h-10 pl-2.5 pr-3 flex items-center gap-1.5">
    <Icon aria-hidden="true" className={`w-4 h-4 ${tone}`} strokeWidth={2.4} />
    <span className={`font-display font-extrabold text-[15px] tabular-nums ${tone}`}>{children}</span>
    <span className="sr-only">{noun}</span>
  </div>
);

const Rate = ({ rarity, tone, children }) => (
  <span className={`inline-flex items-center gap-1.5 ${tone}`}>
    <span aria-hidden="true" className="w-2 h-2 rounded-full" style={{ background: RARITY_METAL[rarity] }} />
    {children}
  </span>
);

// The pack on the table, at full size.
const HeroPack = ({ look, nextPackType }) => (
  <div
    className="relative w-48 h-64 sm:w-52 sm:h-72 rounded-2xl shadow-[0_30px_50px_-22px_rgba(0,0,0,0.95)]"
    style={{ border: '3px solid transparent', background: `${look.face} padding-box, ${look.metal} border-box` }}
  >
    <div className="absolute inset-0 rounded-[13px] overflow-hidden">
      <div className={`absolute inset-x-0 top-0 h-4 ${CRIMP} shadow-[0_2px_4px_rgba(0,0,0,0.35)]`} />
      <div className={`absolute inset-x-0 bottom-0 h-4 ${CRIMP} shadow-[0_-2px_4px_rgba(0,0,0,0.35)]`} />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_90%_55%_at_25%_12%,rgba(255,255,255,0.2),transparent_60%)]" />
      <div className={`absolute inset-0 pointer-events-none ${look.foil}`} />
    </div>
    <div className="relative h-full flex flex-col items-center justify-center px-4 text-center">
      <div className="w-20 h-20 rounded-full p-[3px] shadow-[0_8px_18px_-8px_rgba(0,0,0,0.9)]" style={{ background: look.metal }}>
        <div className="grid place-items-center w-full h-full rounded-full bg-night-950/75">
          <look.Icon aria-hidden="true" className={`w-9 h-9 ${look.tone}`} strokeWidth={1.75} />
        </div>
      </div>
      <div className="mt-4 text-white font-display font-extrabold text-2xl leading-tight [text-shadow:0_2px_6px_rgba(0,0,0,0.6)]">
        {nextPackType === 'legendary' ? 'Legendary Pack' : nextPackType === 'premium' ? 'Premium Pack' : 'Terrible Teddies'}
      </div>
      <div className={`mt-1 label-caps ${look.tagTone}`}>
        {nextPackType === 'legendary' ? 'GUARANTEED LEGENDARY!' : nextPackType === 'premium' ? 'GUARANTEED RARE+' : 'CARD PACK'}
      </div>
      <div className="text-white/80 text-xs mt-2">{nextPackType === 'legendary' ? '10 Cards Inside' : '5 Cards Inside'}</div>
      <div className="mt-4 flex gap-1.5">
        {RARITY_ORDER.map((rarity) => (
          <div
            key={rarity}
            className="w-2.5 h-2.5 rounded-full ring-1 ring-black/40"
            style={{ background: RARITY_METAL[rarity] }}
            title={rarity}
          />
        ))}
      </div>
    </div>
  </div>
);

// One card of the reveal. It is dealt onto the table face down, then turns
// over when its turn comes: a real two-faced flip (each face hides its back),
// so the front is never seen mirrored. The face is only mounted once revealed,
// so nothing about the pull is in the DOM before the player sees it. Everything
// here is a one-shot animation on transform/opacity.
const RevealCard = ({ card, index, revealed }) => {
  const r = RARITY[card.rarity];
  const rank = RARITY_ORDER.indexOf(card.rarity);
  return (
    <motion.div
      initial={{ opacity: 0, y: -40, scale: 0.7 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ delay: index * 0.05, type: 'spring', stiffness: 260, damping: 24 }}
      className="flex flex-col items-center gap-1.5"
    >
      <div className="relative w-24 h-36">
        {/* Rare and up turn over into their own light. */}
        {revealed && rank >= 2 && (
          <motion.div
            aria-hidden="true"
            initial={{ opacity: 0, scale: 0.6 }}
            animate={{ opacity: [0, 1, rank >= 3 ? 0.7 : 0.45], scale: [0.6, 1.2, 1] }}
            transition={{ duration: 0.8, times: [0, 0.4, 1] }}
            className={`absolute -inset-3 rounded-2xl blur-xl bg-gradient-to-br ${r.gradient}`}
          />
        )}
        <motion.div
          initial={false}
          animate={{ rotateY: revealed ? 0 : 180 }}
          transition={{ type: 'spring', stiffness: 220, damping: 20 }}
          style={{ transformStyle: 'preserve-3d', transformPerspective: 900 }}
          className="relative w-24 h-36"
        >
          <div className="absolute inset-0 [backface-visibility:hidden] [-webkit-backface-visibility:hidden] [transform:rotateY(180deg)]">
            <CardBack />
          </div>
          {revealed && (
            <div className="absolute inset-0 [backface-visibility:hidden] [-webkit-backface-visibility:hidden]">
              <TeddyCard teddy={card} />
            </div>
          )}
        </motion.div>
        {revealed && card.isNew && (
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: [0, 1.25, 1], opacity: 1 }}
            transition={{ delay: 0.25, duration: 0.4 }}
            // Up and out past the corner, so it does not sit on the cost coin.
            className="absolute -top-3 -right-3 z-10 inline-flex items-center gap-0.5 rounded-full bg-emerald-300 text-night-950 pl-1 pr-1.5 py-[3px] text-[9px] font-extrabold leading-none ring-2 ring-night-950 shadow-lg"
          >
            <Sparkles aria-hidden="true" className="w-2.5 h-2.5" strokeWidth={2.6} />
            NEW
          </motion.div>
        )}
        {revealed && card.rarity === 'legendary' && (
          <div aria-hidden="true" className="absolute -top-6 left-1/2 -translate-x-1/2 z-10">
            <motion.div
              initial={{ opacity: 0, y: -10, scale: 0.5 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ delay: 0.2, type: 'spring', stiffness: 300, damping: 14 }}
            >
              <Crown className="w-6 h-6 text-brass-300 fill-brass-300/30 drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]" strokeWidth={2} />
            </motion.div>
          </div>
        )}
      </div>
      {/* Fades in as the card finishes turning, not the instant it starts. */}
      <motion.span
        initial={false}
        animate={{ opacity: revealed ? 1 : 0 }}
        transition={{ delay: revealed ? 0.3 : 0, duration: 0.25 }}
        className={`label-caps text-[10px] leading-3 h-3 ${r.text}`}
      >
        {revealed ? card.rarity : ''}
      </motion.span>
    </motion.div>
  );
};

// A mini pack wrapper for the shop tiles, the same look as the pack on the
// table; bundles fan out into a stack so quantity reads at a glance.
const FAN = {
  1: [''],
  2: ['-rotate-[9deg] -translate-x-2', 'rotate-[7deg] translate-x-2'],
  3: ['-rotate-[13deg] -translate-x-3.5 translate-y-1', 'rotate-[13deg] translate-x-3.5 translate-y-1', ''],
};
const MiniPack = ({ look }) => (
  <span
    className="relative block w-10 h-[54px] rounded-[6px] overflow-hidden shadow-[0_8px_16px_-8px_rgba(0,0,0,0.95)]"
    style={{ border: '2px solid transparent', background: `${look.face} padding-box, ${look.metal} border-box` }}
  >
    <span className={`absolute inset-x-0 top-0 h-[4px] ${CRIMP}`} />
    <span className={`absolute inset-x-0 bottom-0 h-[4px] ${CRIMP}`} />
    <span className="absolute inset-0 bg-[radial-gradient(ellipse_90%_55%_at_30%_10%,rgba(255,255,255,0.22),transparent_60%)]" />
    <span className="absolute inset-0 grid place-items-center">
      <look.Icon className={`w-[18px] h-[18px] ${look.tone}`} strokeWidth={2.2} />
    </span>
  </span>
);
const ItemArt = ({ tier, quantity }) => {
  if (tier === 'coins') {
    return (
      <span className="w-12 h-12 rounded-full p-[2px] shadow-[0_8px_16px_-8px_rgba(0,0,0,0.95)]" style={{ background: RARITY_METAL.legendary }}>
        <span className="grid place-items-center w-full h-full rounded-full bg-night-900">
          <Coins className="w-6 h-6 text-brass-300" strokeWidth={2} />
        </span>
      </span>
    );
  }
  const layers = quantity >= 10 ? 3 : quantity >= 5 ? 2 : 1;
  return (
    <span className="grid place-items-center">
      {FAN[layers].map((t, i) => (
        <span key={i} className={`col-start-1 row-start-1 ${t}`}>
          <MiniPack look={PACK_LOOK[tier]} />
        </span>
      ))}
    </span>
  );
};

const ShopItem = ({ tier, quantity = 1, name, description, price, currency, canAfford, onClick, badge }) => (
  <button
    type="button"
    onClick={onClick}
    disabled={!canAfford}
    className={`panel-glass sheen relative h-full rounded-xl px-2 pt-8 pb-3 flex flex-col items-center text-center
      transition-[transform,background-color] duration-200 ${FOCUS}
      ${badge === 'BEST VALUE' ? 'trim-brass' : ''}
      ${canAfford ? 'hover:-translate-y-0.5 hover:bg-night-700/60' : 'opacity-50 cursor-not-allowed'}`}
  >
    {badge && (
      <span
        className={`absolute top-2 left-1/2 -translate-x-1/2 rounded-full px-2 py-[3px] label-caps text-[9px] leading-none whitespace-nowrap ${
          badge === 'BEST VALUE'
            ? 'bg-brass-300 text-night-950'
            : 'bg-night-950/60 text-brass-200 border border-brass-300/50'
        }`}
      >
        {badge}
      </span>
    )}
    <span aria-hidden="true" className="h-16 grid place-items-center">
      <ItemArt tier={tier} quantity={quantity} />
    </span>
    <span className="mt-2 font-display font-extrabold text-[15px] leading-tight text-white">{name}</span>
    <span className="mt-0.5 text-plush-300 text-[11px] leading-snug">{description}</span>
    <span
      className={`mt-auto pt-2.5 inline-flex items-center gap-1 font-display font-extrabold text-sm tabular-nums ${
        currency === 'coins' ? 'text-brass-200' : 'text-fuchsia-200'
      }`}
    >
      <span className="inline-flex items-center gap-1 rounded-full h-7 px-2.5 bg-night-950/70 border border-white/10">
        {currency === 'coins'
          ? <Coins aria-hidden="true" className="w-3.5 h-3.5" strokeWidth={2.4} />
          : <Gem aria-hidden="true" className="w-3.5 h-3.5" strokeWidth={2.4} />}
        {price.toLocaleString()}
        <span className="sr-only">{currency}</span>
      </span>
    </span>
  </button>
);

export default CardPackOpening;
