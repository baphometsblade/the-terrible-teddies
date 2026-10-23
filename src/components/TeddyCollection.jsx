import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, Lock, SearchX, X, Zap } from 'lucide-react';
import { Progress } from "@/components/ui/progress";
import { Medallion } from '@/components/ui/game-chrome';
import TeddyCard from './TeddyCard';
import { useGameStore, ALL_CARDS } from '../stores/gameStore';
import { pressable } from '@/lib/a11y';
import { FOCUS_OUTLINE, FOCUS_RING } from '@/lib/focus';
import { SCRIM_PAD } from '@/lib/safeArea';
import { RARITY, RARITY_METAL, RARITY_ORDER as RARITY_ORDER_ASC } from '@/lib/rarity';
import { useDialog } from '@/hooks/useDialog';
import { buildVisibleOrder, staggerDelay } from '@/lib/collectionOrder';
import { CARD_ZOOM_QUERY, gridArtVariant } from '@/lib/cardZoom';
import { abilityRules } from '@/lib/abilities';
import { effectLabel, effectRules } from '@/lib/effects';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { CLEARANCE, isKeyboardFocus, revealBetween } from '@/lib/keepClear';

// Collection sorts and lists rarest-first.
const RARITY_ORDER = [...RARITY_ORDER_ASC].reverse();

// Segmented filter controls (.seg-well / .seg-on / .seg-off): a recessed well
// with the selected segment raised out of it as a glass key with a lit brass
// lip. Each shrinks to its content: on a phone the groups share one row that
// scrolls sideways, and from sm up they wrap and centre. The raised key
// carries a material shadow, so its focus is an outline (a ring would replace
// the shadow); an unselected segment has none to lose and keeps the ring.
const SEG =
  'inline-flex h-8 shrink-0 items-center justify-center gap-1.5 rounded-lg px-3 text-[13px] font-semibold ' +
  'whitespace-nowrap transition-colors';
const seg = (on) => `${SEG} ${on ? `seg-on ${FOCUS_OUTLINE}` : `seg-off ${FOCUS_RING}`}`;

// A filter group: a small caption beside its keys, which also names the group
// for a screen reader. Beside rather than above, so each row of the strip is
// one key high; and it is shown on phones too, where the row has two "All"
// keys and the caption is what tells them apart. From xl the three groups fit
// one line only with the captions above them, so there they go above. On a
// phone a group keeps its width (the row scrolls); from sm it may shrink to
// the strip, so a well too wide for it wraps inside it instead of running
// past the strip's edges (the six rarity keys did, from 640 to 649px).
const FilterGroup = ({ id, label, className = '', children }) => (
  <div className="flex shrink-0 items-center gap-2 sm:min-w-0 sm:max-w-full sm:shrink xl:flex-col xl:gap-1.5">
    <span id={id} className="label-caps shrink-0 text-[10px] text-plush-300">{label}</span>
    <div role="group" aria-labelledby={id} className={`seg-well flex gap-1 sm:min-w-0 ${className}`}>
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
// small recessed well. `note` is a line of plain rules text under the value
// (what an ability or an effect actually does).
const Stat = ({ label, children, note, className = '' }) => (
  <div className={`rounded-xl bg-night-950/50 px-3 py-2 ring-1 ring-inset ring-white/[0.06] ${className}`}>
    <dt className="label-caps text-[10px] text-plush-300">{label}</dt>
    <dd className="mt-0.5">
      <span className="flex items-center gap-1 font-display text-lg font-extrabold leading-tight">{children}</span>
      {note && <p className="mt-1 text-sm leading-snug text-plush-200">{note}</p>}
    </dd>
  </div>
);

// How much larger than hand size the detail view draws the card: 158x238,
// the size of the art frame it replaced.
const HERO_ZOOM = 1.65;

// Whether the full-size art for this card has arrived. The detail view opens
// on the thumbnail the grid behind it has already loaded, and switches to the
// 768px original only once that is downloaded and decoded, so the card is
// never an empty frame while it downloads; an <img> whose source changes keeps
// painting the old picture until the new one is ready, so the switch sharpens
// in place. A missing original leaves the thumbnail, which is a fine card.
const useFullArtReady = (id) => {
  const [readyId, setReadyId] = useState(null);
  useEffect(() => {
    if (!id || typeof Image === 'undefined') return undefined;
    let live = true;
    const img = new Image();
    img.decoding = 'async';
    img.src = `/cards/${id}.webp`;
    const done = () => { if (live) setReadyId(id); };
    if (typeof img.decode === 'function') img.decode().then(done, () => {});
    else img.onload = done;
    return () => { live = false; };
  }, [id]);
  return readyId === id;
};

// Thumbnails for the cards either side, so paging lands on art rather than an
// empty face when the neighbour is further down the album than the grid has
// loaded. Held in a ref so the requests are not collected before they finish.
const usePreloadThumbs = (cards) => {
  const held = useRef([]);
  const key = cards.map((c) => c.id).join(',');
  useEffect(() => {
    if (typeof Image === 'undefined') return;
    held.current = key.split(',').filter(Boolean).map((id) => {
      const img = new Image();
      img.src = `/cards/thumbs/${id}.webp`;
      return img;
    });
  }, [key]);
};

const PAGE_BUTTON =
  `btn-glass inline-flex h-10 items-center gap-1.5 rounded-xl px-3 text-sm font-semibold ${FOCUS_OUTLINE}`;

// The card-detail panel mounts conditionally, so it hosts its own useDialog
// (the hook must live in a component that mounts with the overlay). Gives the
// panel dialog semantics + focus containment + Escape, so keyboard users can't
// tab into the 40+ card tiles behind it. Mirrors GameBoard's GameOverDialog.
// The header's Close button is the first control, so it is what the hook
// focuses on open.
//
// `cards` is the album as it is showing (filters applied, in grid order) and
// `index` this card's place in it: Previous / Next, and the arrow keys, page
// through it without closing, wrapping at either end.
const CardDetailDialog = ({ cards, index, onIndex, onClose }) => {
  const ref = useDialog(onClose);
  const card = cards[index];
  const count = cards.length;
  const rarity = RARITY[card.rarity];
  const fullArt = useFullArtReady(card.id);
  usePreloadThumbs(count > 1 ? [cards[(index + 1) % count], cards[(index - 1 + count) % count]] : []);
  // Said once a page turns, not on open: the dialog's own name covers that.
  const [announcement, setAnnouncement] = useState('');

  const page = (step) => {
    if (count < 2) return;
    const next = (index + step + count) % count;
    onIndex(next);
    setAnnouncement(`${cards[next].name}, ${next + 1} of ${count}`);
  };
  const onKeyDown = (e) => {
    if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
    if (e.key === 'ArrowRight') { e.preventDefault(); page(1); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); page(-1); }
  };

  const ability = card.ability && card.ability !== 'none' ? card.ability : null;
  const effect = effectLabel(card);
  return (
    <motion.div
      ref={ref}
      role="dialog"
      aria-modal="true"
      aria-label={`${card.name} details`}
      initial={{ scale: 0.92, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 0.95, opacity: 0 }}
      // Focusable by script and click only (never a tab stop), so a click on
      // the description or the stats keeps the focus in the panel, where the
      // arrow keys are heard; it used to fall to <body>, and paging stopped.
      tabIndex={-1}
      className="dialog-panel relative my-auto w-full max-w-lg overflow-hidden rounded-2xl outline-none"
      onClick={(e) => e.stopPropagation()}
      onKeyDown={onKeyDown}
    >
      {/* The tier's light, pooling from the top of the panel behind the card. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-64"
        style={{ background: `radial-gradient(ellipse 70% 80% at 25% 0%, ${rarity.borderHex}38, transparent 70%)` }}
      />
      <p className="sr-only" aria-live="polite">{announcement}</p>

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
          className={`btn-glass grid h-10 w-10 shrink-0 place-items-center rounded-xl ${FOCUS_OUTLINE}`}
        >
          <X aria-hidden="true" className="h-5 w-5" strokeWidth={2.4} />
        </button>
      </div>

      {/* Keyed by card, so a page turn starts the new card from its own art
          (an <img> handed a new source keeps painting the old picture until
          the new one loads, which put the last card's art under this one's
          name) and fades the page in. */}
      <motion.div
        key={card.id}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.15 }}
        className="relative flex flex-col items-center gap-5 px-5 pb-6 pt-4 sm:flex-row sm:items-start sm:px-6"
      >
        {/* The card itself at gallery size: the frame, foil, cost coin, stats
            and rules line the player will see in a hand, not just its art.
            Missing cards are drawn as in the album, art drained under a lock.
            Decorative here (the list beside it says all of it), and not a
            control, so no hover lift and no pointer. No drop-shadow filter:
            the foil sweeps under it, and a filter over moving content is
            redrawn every frame; the card's own shadow seats it. */}
        <div
          aria-hidden="true"
          data-card-hero=""
          className="pointer-events-none relative shrink-0"
          style={{ zoom: HERO_ZOOM }}
        >
          <TeddyCard
            teddy={card}
            dimmed={!card.owned}
            lift={false}
            artVariant={fullArt ? 'full' : 'thumb'}
            artLoading="eager"
          />
          {!card.owned && (
            <div className="absolute inset-0 grid place-items-center">
              <span className="grid h-9 w-9 place-items-center rounded-full bg-night-950/85 ring-1 ring-white/15 shadow-[0_6px_14px_-4px_rgba(0,0,0,0.8)]">
                <Lock className="h-4 w-4 text-plush-200" strokeWidth={2.4} />
              </span>
            </div>
          )}
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
            {ability && (
              <Stat label="Ability" className="col-span-2" note={abilityRules(ability)}>
                <span className="capitalize text-purple-300">{ability}</span>
              </Stat>
            )}
            {effect && (
              <Stat label="Effect" className="col-span-2" note={effectRules(card)}>
                <span className="text-cyan-300">{effect}</span>
              </Stat>
            )}
          </dl>

          {!card.owned && (
            <div className="mt-4 flex items-center justify-center gap-2 rounded-xl bg-night-950/50 px-3 py-2.5 text-sm font-semibold text-plush-200 ring-1 ring-inset ring-white/10">
              <Lock aria-hidden="true" className="h-4 w-4 text-plush-300" strokeWidth={2.4} />
              Not yet collected
            </div>
          )}
        </div>
      </motion.div>

      {/* Paging through the album as it is filtered. Wraps at either end, so
          neither button is ever disabled under the focus. */}
      {count > 1 && (
        <div className="relative flex items-center justify-between gap-3 border-t border-white/[0.06] px-5 py-3 sm:px-6">
          <button type="button" onClick={() => page(-1)} className={PAGE_BUTTON}>
            <ChevronLeft aria-hidden="true" className="h-4 w-4" strokeWidth={2.4} />
            Previous<span className="sr-only"> card</span>
          </button>
          <span aria-hidden="true" data-card-position="" className="font-display text-sm font-bold tabular-nums text-plush-300">
            {index + 1} <span className="text-plush-400">/</span> {count}
          </span>
          <button type="button" onClick={() => page(1)} className={PAGE_BUTTON}>
            Next<span className="sr-only"> card</span>
            <ChevronRight aria-hidden="true" className="h-4 w-4" strokeWidth={2.4} />
          </button>
        </div>
      )}
    </motion.div>
  );
};

const TeddyCollection = () => {
  const { ownedCards } = useGameStore();
  // The id of the card open in the detail view. An id, not the card object,
  // so the view pages through the live album and reads current ownership.
  const [selectedId, setSelectedId] = useState(null);
  const [filter, setFilter] = useState('all');
  const [rarityFilter, setRarityFilter] = useState('all');
  const [showOwned, setShowOwned] = useState(true);
  const artVariant = gridArtVariant(useMediaQuery(CARD_ZOOM_QUERY));

  // The filter strip sticks over the top of the page, so a card the keyboard
  // focuses must come to rest below it, not under it (shift-tabbing up the
  // grid put the focused card behind the strip). See src/lib/keepClear.js for
  // why this is a focus handler rather than scroll-padding on the page.
  const filtersRef = useRef(null);
  const keepCardClear = (e) => {
    const strip = filtersRef.current;
    if (!strip || !isKeyboardFocus(e.target)) return;
    revealBetween(e.target.getBoundingClientRect(), strip.getBoundingClientRect().bottom + CLEARANCE, window.innerHeight);
  };

  // A key the keyboard reaches in the phone's sideways-scrolling filter row
  // is scrolled fully into the row, clear of its right-hand fade (the row's
  // scroll-px-6). Keyboard focus only (:focus-visible): a tap on a half-shown
  // key that scrolled the row between press and release would land on its
  // neighbour, or on nothing.
  const revealFilterKey = (e) => {
    if (isKeyboardFocus(e.target)) e.target.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  };

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
  // The album as it is showing, in grid order: what the detail view pages
  // through. -1 when nothing is open.
  const visibleCards = sortedCards.filter((c) => visibleOrder.has(c.id));
  const selectedIndex = visibleCards.findIndex((c) => c.id === selectedId);

  const totalOwned = ownedCards.length;
  const totalCards = ALL_CARDS.length;
  const completion = (totalOwned / totalCards) * 100;
  const completionPercent = completion.toFixed(1);

  const rarityStats = RARITY_ORDER.map(rarity => {
    const total = ALL_CARDS.filter(c => c.rarity === rarity).length;
    const owned = allCardsWithOwnership.filter(c => c.rarity === rarity && c.owned).length;
    return { rarity, total, owned };
  });

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-4 text-center sm:mb-6">
        <h1 className="font-display text-4xl font-extrabold leading-none tracking-tight text-brass-gradient md:text-5xl">Card Collection</h1>
        <p className="label-caps mt-3 text-plush-300">Your emotional support army</p>
      </div>

      {/* The album's cover sheet: how far along the set is, and by tier. On a
          phone it used to hold the filters too, three rows of them under a
          row of medallions, and at 320x640 it ran to the bottom of the screen
          so the collection opened on no card at all. Below sm the tiers are
          one line of dots and the filters one scrolling row (below). */}
      <div className="panel-glass mb-3 rounded-2xl p-4 sm:mb-4 sm:p-5">
        {/* From md the tally and the medallions share a row. Between md and
            lg the tally is narrower and the gaps tighter, or the medallion
            strip got 52px columns at 768: narrower than the 56px medallions,
            with UNCOMMON's caption running into COMMON's. */}
        <div className="flex flex-col gap-3 sm:gap-5 md:flex-row md:items-center md:gap-6 lg:gap-8">
          <div className="md:w-56 md:shrink-0 lg:w-72">
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
              value={completion}
              aria-label={`Collection progress: ${totalOwned} of ${totalCards} cards`}
              className="mt-3 h-2 bg-night-950/70 ring-1 ring-inset ring-white/[0.06] [&>div]:bg-gradient-to-r [&>div]:from-brass-200 [&>div]:to-brass-500"
            />
          </div>

          <div aria-hidden="true" className="hidden w-px self-stretch bg-white/[0.06] md:block" />

          {/* Phones: each tier as its metal dot and a count, on one line. The
              dot is the same one the rarity filter keys carry just below,
              where each is named; the name is here for a screen reader. */}
          <ul data-tier-tally="" className="flex items-center justify-between gap-1 sm:hidden">
            {rarityStats.map(({ rarity, total, owned }) => (
              <li key={rarity} className="flex items-center gap-1">
                <RarityDot rarity={rarity} className="h-2.5 w-2.5" />
                <span aria-hidden="true" className="font-display text-[13px] font-extrabold leading-none text-white tabular-nums">
                  {owned}<span className="text-plush-300">/{total}</span>
                </span>
                <span className="sr-only">{rarity}: {owned} of {total}</span>
              </li>
            ))}
          </ul>

          {/* From sm: one medallion per tier, rimmed in that tier's card
              metal. The medallion is decorative (aria-hidden), so the count
              is restated for a screen reader beside the caption. The captions
              are in the display face, as on the card itself: it is bundled,
              so the width is the same everywhere, and in the system sans
              UNCOMMON ran into COMMON at 320. */}
          <ul className="hidden flex-1 grid-cols-5 gap-2 sm:grid sm:gap-3">
            {rarityStats.map(({ rarity, total, owned }) => (
              <li key={rarity} className="flex min-w-0 flex-col items-center gap-1.5">
                <Medallion
                  metal={RARITY_METAL[rarity]}
                  className="shadow-[0_6px_14px_-6px_rgba(0,0,0,0.8)] sm:h-14 sm:w-14"
                  discClassName="shadow-[inset_0_2px_6px_rgba(0,0,0,0.6)]"
                >
                  <span className="font-display text-[13px] font-extrabold leading-none text-white tabular-nums sm:text-[15px]">
                    {owned}<span className="text-plush-300">/{total}</span>
                  </span>
                </Medallion>
                <span className="sr-only">{owned} of {total}</span>
                <div className={`label-caps font-display text-[9px] tracking-[0.04em] sm:text-[10px] sm:tracking-[0.12em] ${RARITY[rarity].text}`}>{rarity}</div>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* The filters, on a strip that sticks to the top of the screen, so
          they are in reach from anywhere in a 64-card album instead of only
          from its top. Opaque (dialog-panel), because cards scroll under it
          and there is no blur to separate them (see .dialog-scrim). On a
          phone the three groups are one row that scrolls sideways; from sm
          they wrap and centre. The right-hand fade below sm says there is
          more of the row, and the padding behind it lets the last key scroll
          clear of the fade. */}
      <div
        ref={filtersRef}
        data-collection-filters=""
        className="dialog-panel sticky top-[env(safe-area-inset-top)] z-20 mb-4 rounded-2xl px-2 py-2 sm:mb-6 sm:px-4 sm:py-3"
      >
        <div onFocus={revealFilterKey} className="flex scroll-px-6 gap-4 overflow-x-auto pr-6 [mask-image:linear-gradient(to_right,#000_calc(100%-1.5rem),transparent)] [scrollbar-color:rgba(255,255,255,0.18)_transparent] [scrollbar-width:thin] sm:flex-wrap sm:justify-center sm:gap-x-6 sm:gap-y-2 sm:overflow-visible sm:pr-0 sm:[mask-image:none]">
          <FilterGroup id="collection-filter-show" label="Show">
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

          <FilterGroup id="collection-filter-type" label="Type">
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

          {/* Six segments never fit one phone line, and a row that does not
              fit once pushed the whole document 52px sideways at 390px. Here
              it scrolls inside its strip on a phone, and from sm the well
              wraps when the strip is narrower than it (see FilterGroup). */}
          <FilterGroup id="collection-filter-rarity" label="Rarity" className="sm:flex-wrap sm:justify-center">
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
          line up with it and the gap only grows by a fraction of a card.
          From md up .card-zoom draws the whole grid larger, tracks and all. */}
      <div onFocus={keepCardClear} className={`game-surface card-zoom grid grid-cols-[repeat(auto-fill,6rem)] justify-center gap-x-3 gap-y-4 sm:justify-between sm:gap-x-4 sm:gap-y-5 ${visibleCount > 0 ? 'mb-8' : ''}`}>
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
            {...pressable(() => setSelectedId(card.id), `View ${card.name}`)}
            className={`relative cursor-pointer rounded-[10px] ${FOCUS_RING} ${visibleOrder.has(card.id) ? '' : 'hidden'}`}
          >
            {/* Missing cards: the art drained of most colour and light, under
                a lock — still recognisably the card you are hunting for. Only
                the art: filtering the whole card took its name, cost, stats
                and rules line below AA, on a tile that is still a control. */}
            <TeddyCard teddy={card} dimmed={!card.owned} artVariant={artVariant} />
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
        {selectedIndex >= 0 && (
          // Scrolls, with the panel centred by my-auto rather than
          // items-center: a centred flex item taller than its box overflows
          // at both ends, which on a short phone cut off the panel's top.
          <motion.div
            key="card-detail"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className={`fixed inset-0 z-50 dialog-scrim flex items-start justify-center overflow-y-auto ${SCRIM_PAD}`}
            onClick={() => setSelectedId(null)}
          >
            <CardDetailDialog
              cards={visibleCards}
              index={selectedIndex}
              onIndex={(i) => setSelectedId(visibleCards[i].id)}
              onClose={() => setSelectedId(null)}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default TeddyCollection;
