import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Package, PackageOpen, Gem, Crown, Coins, X, Sparkles, PartyPopper } from 'lucide-react';
import TeddyCard, { CardBack } from './TeddyCard';
import { useGameStore } from '../stores/gameStore';
import { useDialog } from '@/hooks/useDialog';
import { celebrate } from '@/lib/celebrate';
import { FOCUS_OUTLINE } from '@/lib/focus';
import { Medallion, BalanceChip } from '@/components/ui/game-chrome';
import { PACK_LOOK, HeroPack, PackStack } from './PackArt';

import { RARITY, RARITY_ORDER, RARITY_METAL } from '@/lib/rarity';

// Plain <button>s rather than the shadcn Button: its bg-primary is a utility
// and would beat the component-layer btn-brass / btn-glass materials.
const ACTION = `inline-flex items-center justify-center gap-2 h-11 rounded-xl font-display font-bold whitespace-nowrap ${FOCUS_OUTLINE}`;

// panel-glass paints a gradient IMAGE, so a hover background-color sits under
// it and never shows. The hover state is a lighter image instead.
const TILE_HOVER = 'hover:[background-image:linear-gradient(180deg,rgba(59,45,84,0.85),rgba(32,23,47,0.92))]';

// Same wiring as the GameBoard's fitField: CSS zoom, not transform, so bigger
// cards take the room they appear to. The zoom is measured rather than set at
// a breakpoint, because a breakpoint cannot know whether five zoomed cards fit:
// at md:[zoom:1.4] an iPad in portrait dealt 4 + 1. The row is capped at five
// cards (5 x 96 + 4 x 16 = 544, plus slack), and only zoomed once that cap
// fits; below it the cards stay 96px and wrap. A ten-card pack is two rows.
const ROW_CAP = 552;

const CardPackOpening = ({ onClose }) => {
  const { cardPacks, premiumPacks, legendaryPacks, openCardPack, coins, gems, buyShopItem, getNextPackType } = useGameStore();
  const [isOpening, setIsOpening] = useState(false);
  const [pulledCards, setPulledCards] = useState(null);
  const [dupeCoins, setDupeCoins] = useState(0);
  const [revealedIndex, setRevealedIndex] = useState(-1);
  const [showPack, setShowPack] = useState(true);
  const [packAnimation, setPackAnimation] = useState(false);
  // The tier being opened. The store consumes the pack 1.2s in, after which
  // getNextPackType() already names the NEXT pack, so the stage light used to
  // switch tiers for the whole reveal of the last premium or legendary pack.
  const [openedType, setOpenedType] = useState(null);
  // What a screen reader hears: the tear, each card as it turns, the summary.
  // Always mounted, so a change to its text is announced.
  const [announcement, setAnnouncement] = useState('');

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

  const stageRef = useRef(null);
  const closeRef = useRef(null);
  const openRef = useRef(null);
  const openAnotherRef = useRef(null);
  const doneRef = useRef(null);

  // The card table's width, for the reveal row's zoom.
  const fieldRef = useRef(null);
  const [fieldWidth, setFieldWidth] = useState(0);
  useEffect(() => {
    const el = fieldRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(([entry]) => setFieldWidth(entry.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const fireConfetti = (rarity) => {
    celebrate({
      particleCount: rarity === 'legendary' ? 150 : rarity === 'epic' ? 100 : 50,
      spread: 70,
      origin: { y: 0.6 },
      colors: RARITY[rarity]?.hex || ['#FFFFFF'],
    });
  };

  const handleOpenPack = () => {
    if (totalPacks <= 0 || isOpening) return;

    const opening = getNextPackType();
    setIsOpening(true);
    setPackAnimation(true);
    setPulledCards(null);
    setRevealedIndex(-1);
    setOpenedType(opening);
    setAnnouncement(`Opening ${opening === 'legendary' ? 'Legendary ' : opening === 'premium' ? 'Premium ' : ''}pack…`);
    // The control that was pressed unmounts now. Hold focus on the table
    // until the reveal ends, rather than letting it fall out of the dialog.
    stageRef.current?.focus({ preventScroll: true });

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
        setOpenedType(null);
        setAnnouncement('');
        return;
      }
      const { cards, dupeCoins: refund } = result;
      setOpenedType(packType);
      setPulledCards(cards);
      setDupeCoins(refund);

      cards.forEach((card, index) => {
        track(setTimeout(() => {
          setRevealedIndex(index);
          setAnnouncement(
            `${card.name}, ${card.rarity}${card.isNew ? ', new' : ''}. Card ${index + 1} of ${cards.length}.`
          );
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

  // When the reveal ends, hand focus to the next thing to do (Open Another, or
  // Done), then say how it went: the summary goes after the focus move, which
  // a screen reader would otherwise speak over it. Scrolled into view only for
  // a keyboard user — a sighted mouse user is watching the cards.
  const wasOpening = useRef(false);
  useEffect(() => {
    if (isOpening) { wasOpening.current = true; return; }
    if (!wasOpening.current) return;
    wasOpening.current = false;
    const keyboard = document.activeElement?.matches?.(':focus-visible') ?? false;
    const next = pulledCards ? (openAnotherRef.current || doneRef.current) : openRef.current;
    next?.focus({ preventScroll: !keyboard });
    if (pulledCards) {
      const fresh = pulledCards.filter(c => c.isNew).length;
      setAnnouncement([
        `Pack opened: ${pulledCards.length} cards.`,
        fresh > 0 ? `${fresh} new card${fresh > 1 ? 's' : ''} added to collection!` : '',
        dupeCoins > 0 ? `+${dupeCoins} coins for duplicate cards.` : '',
      ].filter(Boolean).join(' '));
    }
  }, [isOpening, pulledCards, dupeCoins]);

  // While the table holds focus there is nothing after it to Tab to (the shop
  // is hidden mid-reveal), and the browser would carry focus out of the dialog.
  const onStageKeyDown = (e) => {
    if (e.key !== 'Tab' || e.shiftKey || e.target !== e.currentTarget) return;
    if (e.currentTarget.querySelector('button')) return;
    e.preventDefault();
    closeRef.current?.focus();
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
    setOpenedType(null);
    setAnnouncement('');
  };

  const resetAndClose = () => {
    resetView();
    onClose();
  };

  const dialogRef = useDialog(resetAndClose);

  const newCardsCount = pulledCards ? pulledCards.filter(c => c.isNew).length : 0;

  const look = PACK_LOOK[nextPackType] || PACK_LOOK.regular;
  // The stage is lit by the pack being opened while it opens and is revealed,
  // and by the pack on the table otherwise.
  const litType = ((isOpening || pulledCards) ? openedType : nextPackType) || nextPackType || 'regular';
  const tierName = nextPackType === 'legendary' ? 'Legendary' : nextPackType === 'premium' ? 'Premium' : '';
  const canOpen = totalPacks > 0 && !isOpening;
  // Only the tear needs the case to clip (its flash grows to ~2.3x the pack).
  // Clipping the reveal cut the rare+ glows off in a hard line along the case
  // wall on phones and sat the legendary crown on the top edge.
  const tearing = packAnimation && showPack;

  const fits = fieldWidth >= ROW_CAP;
  const zoom = pulledCards && fits ? Math.min(pulledCards.length > 5 ? 1.15 : 1.4, fieldWidth / ROW_CAP) : 1;

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
        {/* Header. Below md the balances take their own row under the title
            and the close control: from sm they no longer fit beside a
            "Card Packs" title and the X wrapped under it. */}
        <div className="relative flex flex-wrap items-center gap-3 px-3 sm:px-6 pt-4 sm:pt-5 pb-4">
          <div className="flex items-center gap-3 min-w-0 mr-auto">
            <Medallion icon={Package} />
            <h1 className="font-display text-3xl md:text-4xl font-extrabold leading-none text-brass-gradient">
              Card Packs
            </h1>
          </div>
          <div className="order-last w-full md:order-none md:w-auto flex flex-wrap items-center gap-2">
            <BalanceChip icon={Coins} tone="text-brass-300" noun="coins" value={coins.toLocaleString()} />
            <BalanceChip icon={Gem} tone="text-fuchsia-300" noun="gems" value={gems.toLocaleString()} />
            <BalanceChip
              icon={Package}
              tone="text-sky-300"
              noun="packs to open"
              value={(
                <>
                  {totalPacks}
                  {(premiumPacks > 0 || legendaryPacks > 0) && (
                    <span className="ml-1 font-sans text-xs font-semibold text-plush-300">
                      ({cardPacks}+{premiumPacks}P+{legendaryPacks}L)
                    </span>
                  )}
                </>
              )}
            />
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={resetAndClose}
            className={`btn-glass grid place-items-center w-10 h-10 shrink-0 rounded-xl ${FOCUS_OUTLINE}`}
            aria-label="Close card packs"
          >
            <X aria-hidden="true" className="w-5 h-5" strokeWidth={2.4} />
          </button>
        </div>

        <div className="relative px-3 sm:px-6 pb-5 sm:pb-6">
          <p role="status" className="sr-only">{announcement}</p>

          {/* The stage: a lit display case the pack sits in and the cards are
              dealt onto. Isolated so the pack's glow can sit behind it. It
              holds focus while a pack opens (the Open button is gone by then),
              hence the tab index and the name. */}
          <div
            ref={stageRef}
            tabIndex={-1}
            role="group"
            aria-label="Pack table"
            onKeyDown={onStageKeyDown}
            className={`relative isolate rounded-2xl border border-white/5 bg-night-950/55 shadow-[inset_0_2px_24px_rgba(0,0,0,0.65)] px-3 py-6 sm:p-8 outline-none ${
              tearing ? 'overflow-hidden' : ''
            }`}
          >
            {/* The tier's light, one layer per tier, cross-faded on opacity
                (a gradient cannot be transitioned). */}
            {Object.entries(PACK_LOOK).map(([type, l]) => (
              <div
                key={type}
                aria-hidden="true"
                className={`absolute inset-0 -z-10 rounded-[inherit] transition-opacity duration-500 motion-reduce:transition-none [[data-motion=off]_&]:transition-none ${
                  type === litType ? 'opacity-100' : 'opacity-0'
                }`}
                style={{ background: `radial-gradient(ellipse 60% 70% at 50% 0%, ${l.light}, transparent 70%)` }}
              />
            ))}

            {/* Pack display / Card reveal */}
            <div ref={fieldRef} className="flex flex-col items-center justify-center min-h-[300px]">
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
                    {/* The light the pack sits in. No blur: the gradient already
                        fades to nothing, and a pulsing 40px blur was redrawn on
                        every frame of an idle screen. It pulses only while there
                        is a pack to open, and goes out when there is none. */}
                    {totalPacks > 0 && (
                      <div
                        aria-hidden="true"
                        className={`absolute -inset-10 -z-10 rounded-full ${canOpen ? 'motion-safe:animate-pulse' : ''}`}
                        style={{ background: `radial-gradient(ellipse at center, ${look.glow}, transparent 70%)` }}
                      />
                    )}
                    <div className={`transition-transform duration-300 ${canOpen ? 'hover:-translate-y-1.5' : ''}`}>
                      <HeroPack look={look} dimmed={totalPacks === 0} />
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
                    {/* gap-y-6: the legendary crown stands 24px above its card,
                        and in a narrower gap it sat on the caption above. */}
                    <div
                      className={`mx-auto flex flex-wrap justify-center gap-y-6 max-w-[552px] ${fits ? 'gap-x-4' : 'gap-x-3'}`}
                      style={zoom !== 1 ? { zoom } : undefined}
                    >
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
                // Below sm it sheds the icon and some padding: at 320 the
                // Legendary label alone is wider than the case at text-lg.
                <button
                  ref={openRef}
                  type="button"
                  onClick={handleOpenPack}
                  className={`${ACTION} btn-brass sheen relative px-4 text-base sm:px-8 sm:text-lg`}
                >
                  <PackageOpen aria-hidden="true" className="hidden min-[360px]:block w-5 h-5" strokeWidth={2.2} />
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
                      ref={openAnotherRef}
                      type="button"
                      onClick={() => { resetView(); handleOpenPack(); }}
                      className={`${ACTION} btn-brass px-6 text-base`}
                    >
                      <PackageOpen aria-hidden="true" className="w-5 h-5" strokeWidth={2.2} />
                      Open Another ({totalPacks})
                    </button>
                  )}
                  <button ref={doneRef} type="button" onClick={resetAndClose} className={`${ACTION} btn-glass sm:min-w-[7rem] px-6 text-base`}>
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

const Rate = ({ rarity, tone, children }) => (
  <span className={`inline-flex items-center gap-1.5 ${tone}`}>
    <span aria-hidden="true" className="w-2 h-2 rounded-full" style={{ background: RARITY_METAL[rarity] }} />
    {children}
  </span>
);

// One card of the reveal. It is dealt onto the table face down, then turns
// over when its turn comes: a real two-faced flip (each face hides its back),
// so the front is never seen mirrored. The face is only mounted once revealed,
// so nothing about the pull is in the DOM before the player sees it. Everything
// here is a one-shot animation on transform/opacity.
//
// The back stays mounted under the face for the flip, so it is aria-hidden:
// backface-visibility hides it from the eye only, and its 🧸 prefixed every
// revealed card with "teddy bear" for a screen reader.
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
        {!revealed && <span className="sr-only">Face-down card</span>}
        <motion.div
          initial={false}
          animate={{ rotateY: revealed ? 0 : 180 }}
          transition={{ type: 'spring', stiffness: 220, damping: 20 }}
          style={{ transformStyle: 'preserve-3d', transformPerspective: 900 }}
          className="relative w-24 h-36"
        >
          <div aria-hidden="true" className="absolute inset-0 [backface-visibility:hidden] [-webkit-backface-visibility:hidden] [transform:rotateY(180deg)]">
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

// The shop tiles' art: the same pack wrapper as the Shop's (PackArt), fanned
// into a stack for a bundle; the coin bag is a brass coin.
const ItemArt = ({ tier, quantity }) => {
  if (tier === 'coins') {
    return <Medallion icon={Coins} className="shadow-[0_8px_16px_-8px_rgba(0,0,0,0.95)]" />;
  }
  return <PackStack look={PACK_LOOK[tier]} quantity={quantity} size="sm" />;
};

const ShopItem = ({ tier, quantity = 1, name, description, price, currency, canAfford, onClick, badge }) => (
  <button
    type="button"
    onClick={onClick}
    disabled={!canAfford}
    className={`panel-glass sheen relative h-full rounded-xl px-2 pt-8 pb-3 flex flex-col items-center text-center
      transition-transform duration-200 ${FOCUS_OUTLINE}
      ${badge === 'BEST VALUE' ? 'trim-brass' : ''}
      ${canAfford ? `hover:-translate-y-0.5 ${TILE_HOVER}` : 'opacity-50 cursor-not-allowed'}`}
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
