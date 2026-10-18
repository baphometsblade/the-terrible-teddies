import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Lock, SearchX, X, Zap } from 'lucide-react';
import { Progress } from "@/components/ui/progress";
import TeddyCard, { ArtOrEmoji } from './TeddyCard';
import { useGameStore, ALL_CARDS } from '../stores/gameStore';
import { pressable } from '@/lib/a11y';
import { RARITY, RARITY_METAL, RARITY_ORDER as RARITY_ORDER_ASC } from '@/lib/rarity';
import { useDialog } from '@/hooks/useDialog';
import { buildVisibleOrder, staggerDelay } from '@/lib/collectionOrder';

// Collection sorts and lists rarest-first.
const RARITY_ORDER = [...RARITY_ORDER_ASC].reverse();

const FOCUS_RING =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass-300 ' +
  'focus-visible:ring-offset-2 focus-visible:ring-offset-night-900';

// Segmented filter controls: a recessed well with the selected segment raised
// out of it as a glass key with a lit brass lip. Below sm each control is a
// full-width grid, so the rows line up and wrap into tidy columns rather than
// running off a phone; from sm up they shrink to their content and sit side
// by side. The selected segment's box-shadow restates .btn-glass's own (rim +
// drop) because a shadow utility replaces the material's, it cannot add to it.
const SEG_GROUP =
  'w-full sm:w-auto gap-1 rounded-xl bg-night-950/55 p-1 ring-1 ring-inset ring-white/[0.07] ' +
  'shadow-[inset_0_1px_3px_rgba(0,0,0,0.45)]';
const SEG =
  'inline-flex h-8 items-center justify-center gap-1.5 rounded-lg px-3 text-[13px] font-semibold ' +
  'whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass-300';
const SEG_ON =
  'btn-glass text-brass-200 shadow-[inset_0_1px_0_rgba(255,255,255,0.07),inset_0_-2px_0_rgba(251,191,36,0.55),0_4px_10px_-6px_rgba(0,0,0,0.8)]';
const SEG_OFF = 'border border-transparent text-plush-300 hover:bg-white/[0.04] hover:text-white';
const seg = (on) => `${SEG} ${on ? SEG_ON : SEG_OFF}`;

// A filter group: a small caption (sm and up — on a phone the segments explain
// themselves and the height is better spent on cards) that also names the
// group for a screen reader, which still reads it while it is display:none.
const FilterGroup = ({ id, label, className, children }) => (
  <div className="flex w-full flex-col items-center gap-1.5 sm:w-auto">
    <span id={id} className="label-caps hidden text-[10px] text-plush-300 sm:block">{label}</span>
    <div role="group" aria-labelledby={id} className={`${SEG_GROUP} ${className}`}>
      {children}
    </div>
  </div>
);

// The metal dot that marks a rarity: the same gradient as that tier's card frame.
const RarityDot = ({ rarity, className = 'h-2 w-2' }) => (
  <span
    aria-hidden="true"
    className={`shrink-0 rounded-full ring-1 ring-black/40 ${className}`}
    style={{ background: RARITY_METAL[rarity] }}
  />
);

// One fact about a card in the detail dialog: a caption over a value, in a
// small recessed well.
const Stat = ({ label, children, className = '' }) => (
  <div className={`rounded-xl bg-night-950/50 px-3 py-2 ring-1 ring-inset ring-white/[0.06] ${className}`}>
    <dt className="label-caps text-[10px] text-plush-300">{label}</dt>
    <dd className="mt-0.5 flex items-center gap-1 font-display text-lg font-extrabold leading-tight">{children}</dd>
  </div>
);

// The card-detail panel mounts conditionally, so it hosts its own useDialog
// (the hook must live in a component that mounts with the overlay). Gives the
// panel dialog semantics + focus containment + Escape, so keyboard users can't
// tab into the 40+ card tiles behind it. Mirrors GameBoard's GameOverDialog.
// The header's Close button is the first control, so it is what the hook
// focuses on open.
const CardDetailDialog = ({ card, onClose }) => {
  const ref = useDialog(onClose);
  const rarity = RARITY[card.rarity];
  const foil = card.rarity === 'legendary' ? 'foil' : card.rarity === 'epic' ? 'foil foil-epic' : '';
  return (
    <motion.div
      ref={ref}
      role="dialog"
      aria-modal="true"
      aria-label={`${card.name} details`}
      initial={{ scale: 0.92, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 0.95, opacity: 0 }}
      className="dialog-panel relative my-auto w-full max-w-lg overflow-hidden rounded-2xl"
      onClick={(e) => e.stopPropagation()}
    >
      {/* The tier's light, pooling from the top of the panel behind the art. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-64"
        style={{ background: `radial-gradient(ellipse 70% 80% at 25% 0%, ${rarity.borderHex}38, transparent 70%)` }}
      />

      <div className="relative flex items-start justify-between gap-3 px-5 pt-5 sm:px-6 sm:pt-6">
        <div className="min-w-0">
          <div className={`label-caps flex items-center gap-1.5 ${rarity.text}`}>
            <RarityDot rarity={card.rarity} />
            {card.rarity}
          </div>
          <h2 className="mt-1 font-display text-2xl font-extrabold leading-tight text-white sm:text-[1.75rem]">{card.name}</h2>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className={`btn-glass grid h-10 w-10 shrink-0 place-items-center rounded-xl ${FOCUS_RING}`}
        >
          <X aria-hidden="true" className="h-5 w-5" strokeWidth={2.4} />
        </button>
      </div>

      <div className="relative flex flex-col items-center gap-5 px-5 pb-6 pt-4 sm:flex-row sm:items-start sm:px-6">
        {/* Big art frame: the card's illustration at gallery size in its
            tier's metal, falling back to the emoji cast when no art has
            shipped. Epic and legendary carry the same foil as the card. */}
        <div
          className="relative h-60 w-40 shrink-0 rounded-xl p-[3px] shadow-[0_18px_32px_-12px_rgba(0,0,0,0.85)]"
          style={{ background: RARITY_METAL[card.rarity] }}
        >
          <div className={`relative grid h-full w-full place-items-center overflow-hidden rounded-[9px] bg-gradient-to-b ${rarity.bg}`}>
            <ArtOrEmoji
              teddy={card}
              variant="full"
              emojiClassName="text-7xl drop-shadow-[0_4px_8px_rgba(0,0,0,0.5)]"
              imgClassName="absolute inset-0 h-full w-full object-cover"
            />
            {foil && <div aria-hidden="true" className={`pointer-events-none absolute inset-0 ${foil}`} />}
          </div>
        </div>

        <div className="w-full min-w-0 flex-1">
          <p className="text-sm leading-relaxed text-plush-200">{card.description}</p>

          <dl className="mt-4 grid grid-cols-2 gap-2">
            <Stat label="Type"><span className="capitalize text-white">{card.type}</span></Stat>
            <Stat label="Cost">
              <Zap aria-hidden="true" className="h-4 w-4 text-brass-300" fill="currentColor" strokeWidth={1.5} />
              <span className="tabular-nums text-brass-300">{card.cost}</span>
            </Stat>
            {card.type === 'action' && (
              <>
                <Stat label="Attack"><span className="tabular-nums text-red-300">{card.attack}</span></Stat>
                <Stat label="Defense"><span className="tabular-nums text-sky-300">{card.defense}</span></Stat>
              </>
            )}
            {card.ability && card.ability !== 'none' && (
              <Stat label="Ability" className="col-span-2"><span className="capitalize text-purple-300">{card.ability}</span></Stat>
            )}
            {card.effect && (
              <Stat label="Effect" className="col-span-2"><span className="capitalize text-cyan-300">{card.effect} {card.amount}</span></Stat>
            )}
          </dl>

          {!card.owned && (
            <div className="mt-4 flex items-center justify-center gap-2 rounded-xl bg-night-950/50 px-3 py-2.5 text-sm font-semibold text-plush-200 ring-1 ring-inset ring-white/10">
              <Lock aria-hidden="true" className="h-4 w-4 text-plush-300" strokeWidth={2.4} />
              Not yet collected
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
};

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

  // The full catalog, sorted once. Filtering hides tiles rather than removing
  // them — see the grid below for why.
  const sortedCards = [...allCardsWithOwnership].sort((a, b) => {
    return RARITY_ORDER.indexOf(a.rarity) - RARITY_ORDER.indexOf(b.rarity);
  });

  const matchesFilters = (card) => {
    if (showOwned && !card.owned) return false;
    if (!showOwned && card.owned) return false;
    if (filter !== 'all' && card.type !== filter) return false;
    if (rarityFilter !== 'all' && card.rarity !== rarityFilter) return false;
    return true;
  };

  // Ordinal among the tiles that are actually SHOWING, not position in the
  // catalog — the grid hides non-matching tiles rather than unmounting them, so
  // the two differ under every filter but "all". `size` is the visible count.
  const visibleOrder = buildVisibleOrder(sortedCards, matchesFilters);
  const visibleCount = visibleOrder.size;

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
        <h1 className="font-display text-4xl font-extrabold leading-none tracking-tight text-brass-gradient md:text-5xl">Card Collection</h1>
        <p className="label-caps mt-3 text-plush-300">Your emotional support army</p>
      </div>

      {/* The album's cover sheet: how far along the set is, by tier, and the
          filters for what to look at. */}
      <div className="panel-glass mb-7 rounded-2xl p-4 sm:p-5">
        <div className="flex flex-col gap-5 md:flex-row md:items-center md:gap-8">
          <div className="md:w-72 md:shrink-0">
            <div className="flex items-end justify-between gap-4">
              <div>
                <div className="label-caps text-plush-300">Collected</div>
                <div className="mt-1 font-display text-3xl font-extrabold leading-none text-white tabular-nums">
                  {totalOwned}<span className="text-xl font-bold text-plush-300"> / {totalCards}</span>
                </div>
              </div>
              <div className="text-right">
                <div className="label-caps text-plush-300">Complete</div>
                <div className="mt-1 font-display text-3xl font-extrabold leading-none text-brass-gradient tabular-nums">{completionPercent}%</div>
              </div>
            </div>
            <Progress
              value={(totalOwned / totalCards) * 100}
              aria-label={`Collection progress: ${totalOwned} of ${totalCards} cards`}
              className="mt-3 h-2 bg-night-950/70 ring-1 ring-inset ring-white/[0.06] [&>div]:bg-gradient-to-r [&>div]:from-brass-200 [&>div]:to-brass-500"
            />
          </div>

          <div aria-hidden="true" className="hidden w-px self-stretch bg-white/[0.06] md:block" />

          {/* One medallion per tier, rimmed in that tier's card metal. */}
          <ul className="grid flex-1 grid-cols-5 gap-2 sm:gap-3">
            {rarityStats.map(({ rarity, total, owned }) => (
              <li key={rarity} className="flex min-w-0 flex-col items-center gap-1.5">
                <div
                  className="h-12 w-12 rounded-full p-[2px] shadow-[0_6px_14px_-6px_rgba(0,0,0,0.8)] sm:h-14 sm:w-14"
                  style={{ background: RARITY_METAL[rarity] }}
                >
                  <div className="grid h-full w-full place-items-center rounded-full bg-night-900 shadow-[inset_0_2px_6px_rgba(0,0,0,0.6)]">
                    <span className="font-display text-[13px] font-extrabold leading-none text-white tabular-nums sm:text-[15px]">
                      {owned}<span className="text-plush-300">/{total}</span>
                    </span>
                  </div>
                </div>
                <div className={`label-caps text-[9px] tracking-[0.04em] sm:text-[10px] sm:tracking-[0.12em] ${RARITY[rarity].text}`}>{rarity}</div>
              </li>
            ))}
          </ul>
        </div>

        <div aria-hidden="true" className="my-4 h-px bg-white/[0.06] sm:my-5" />

        <div className="flex flex-wrap justify-center gap-x-6 gap-y-3 sm:gap-y-4">
          <FilterGroup id="collection-filter-show" label="Show" className="grid grid-cols-2 sm:inline-flex">
            <button
              type="button"
              onClick={() => setShowOwned(true)}
              aria-pressed={showOwned}
              className={seg(showOwned)}
            >
              Owned <span className={`tabular-nums ${showOwned ? 'text-brass-200' : 'text-plush-300'}`}>({totalOwned})</span>
            </button>
            <button
              type="button"
              onClick={() => setShowOwned(false)}
              aria-pressed={!showOwned}
              className={seg(!showOwned)}
            >
              Missing <span className={`tabular-nums ${!showOwned ? 'text-brass-200' : 'text-plush-300'}`}>({totalCards - totalOwned})</span>
            </button>
          </FilterGroup>

          <FilterGroup id="collection-filter-type" label="Type" className="grid grid-cols-4 sm:inline-flex">
            {['all', 'action', 'trap', 'special'].map(type => (
              <button
                type="button"
                key={type}
                onClick={() => setFilter(type)}
                aria-pressed={filter === type}
                className={seg(filter === type)}
              >
                {type === 'all' ? 'All' : type.charAt(0).toUpperCase() + type.slice(1)}
              </button>
            ))}
          </FilterGroup>

          {/* Six segments never fit one phone line (the row once pushed the
              whole document 52px sideways at 390px): a 3x2 grid below sm,
              a wrapping row above. */}
          <FilterGroup id="collection-filter-rarity" label="Rarity" className="grid grid-cols-3 sm:inline-flex sm:flex-wrap sm:justify-center">
            {['all', ...RARITY_ORDER].map(rarity => (
              <button
                type="button"
                key={rarity}
                onClick={() => setRarityFilter(rarity)}
                aria-pressed={rarityFilter === rarity}
                className={`${seg(rarityFilter === rarity)} capitalize`}
              >
                {rarity !== 'all' && <RarityDot rarity={rarity} />}
                {rarity}
              </button>
            ))}
          </FilterGroup>
        </div>
      </div>

      {/* Fixed 6rem tracks — the card's own width — so the cards read as one
          collection rather than a few cards adrift in wide columns. On a
          phone the three tracks sit centred at a tight gap; from sm up the
          tracks spread to the panel's edges, so the first and last columns
          line up with it and the gap only grows by a fraction of a card. */}
      <div className={`grid grid-cols-[repeat(auto-fill,6rem)] justify-center gap-x-3 gap-y-4 sm:justify-between sm:gap-x-4 sm:gap-y-5 ${visibleCount > 0 ? 'mb-8' : ''}`}>
        {/* Every tile stays mounted; a filter change toggles `hidden` on the
            ones that don't match.

            It used to be an AnimatePresence over the FILTERED list, so each
            filter tap unmounted and remounted up to 64 tiles — 128 Framer
            Motion components (each tile wraps a TeddyCard that is itself a
            motion.div) torn down and rebuilt with staggered enter and exit
            animations. Measured at 6x CPU throttle with card images blocked, so
            this was pure JS and not image decode: 1372ms of blocked main thread
            per filter tap, 98% saturated across ten taps. Hiding instead of
            unmounting makes it an ordinary re-render, and the entrance stagger
            now plays once on mount instead of on every tap.

            `hidden` is display:none, so hidden tiles also leave the
            accessibility tree and the tab order — which is what we want. */}
        {sortedCards.map((card) => (
          <motion.div
            key={card.id}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: staggerDelay(visibleOrder.get(card.id)) }}
            {...pressable(() => setSelectedCard(card), `View ${card.name}`)}
            className={`relative cursor-pointer rounded-[10px] ${FOCUS_RING} ${visibleOrder.has(card.id) ? '' : 'hidden'}`}
          >
            {/* Missing cards: drained of most colour and light, under a lock —
                still recognisably the card you are hunting for, and a hint
                of the tier's metal survives in the frame. */}
            <div className={card.owned ? '' : 'saturate-[0.3] brightness-[0.55]'}>
              <TeddyCard teddy={card} />
            </div>
            {!card.owned && (
              <div className="pointer-events-none absolute inset-0 grid place-items-center">
                <span className="grid h-9 w-9 place-items-center rounded-full bg-night-950/85 ring-1 ring-white/15 shadow-[0_6px_14px_-4px_rgba(0,0,0,0.8)]">
                  <Lock aria-hidden="true" className="h-4 w-4 text-plush-200" strokeWidth={2.4} />
                </span>
              </div>
            )}
          </motion.div>
        ))}
      </div>

      {visibleCount === 0 && (
        <div className="panel-glass mx-auto mb-8 flex max-w-sm flex-col items-center gap-3 rounded-2xl px-6 py-10 text-center">
          <span aria-hidden="true" className="grid h-12 w-12 place-items-center rounded-full bg-white/5 ring-1 ring-white/10">
            <SearchX className="h-6 w-6 text-plush-300" strokeWidth={2} />
          </span>
          <p className="text-plush-200">No cards match your filters.</p>
        </div>
      )}

      <AnimatePresence>
        {selectedCard && (
          // Scrolls, with the panel centred by my-auto rather than
          // items-center: a centred flex item taller than its box overflows
          // at both ends, which on a short phone cut off the panel's top.
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 dialog-scrim flex items-start justify-center overflow-y-auto p-4"
            onClick={() => setSelectedCard(null)}
          >
            <CardDetailDialog card={selectedCard} onClose={() => setSelectedCard(null)} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default TeddyCollection;
