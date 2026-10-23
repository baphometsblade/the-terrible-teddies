import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Package, PackageOpen, Crown, Coins, X, Sparkles, PartyPopper } from 'lucide-react';
import TeddyCard, { CardBack } from './TeddyCard';
import { useGameStore } from '../stores/gameStore';
import { useDialog } from '@/hooks/useDialog';
import { celebrate } from '@/lib/celebrate';
import { FOCUS_OUTLINE } from '@/lib/focus';
import { Medallion, SectionHeading, WalletChips } from '@/components/ui/game-chrome';
import { PACK_LOOK, HeroPack } from './PackArt';
import { StoreTile, storeItems, bestValuePackId, useStoreBuy } from './StoreTile';
import { PackOddsGuide } from './PackOdds';
import { RARITY, RARITY_ORDER } from '@/lib/rarity';
import { revealOrder, waveRanges, tableLayout } from '@/lib/packReveal';

// Plain <button>s rather than the shadcn Button: its bg-primary is a utility
// and would beat the component-layer btn-brass / btn-glass materials.
const ACTION = `inline-flex items-center justify-center gap-2 h-11 rounded-xl font-display font-bold whitespace-nowrap ${FOCUS_OUTLINE}`;

// The reveal's pacing. The player turns the cards (each face-down card is a
// button); the timers are only the fallback for a player who just watches.
const TEAR_MS = 1200;      // the pack straining and tearing open
const DEAL_MS = 450;       // the deal, before a wave can be turned
const ART_HOLD_MS = 700;   // the most the first turn waits for its art to decode
const IDLE_MS = 900;       // untouched, the next card turns itself after this
const BEAT_MS = 800;       // the held beat before an epic or legendary turns
const WAVE_IDLE_MS = 1800; // untouched, the next wave is dealt after this
const END_MS = 500;        // the last card settling before the summary

const RARE = RARITY_ORDER.indexOf('rare');
const EPIC = RARITY_ORDER.indexOf('epic');
const rankOf = (card) => RARITY_ORDER.indexOf(card.rarity);
// The stage light a rarity earns: the pack tier that wears its metal.
const LOOK_RANK = { regular: 0, premium: 1, legendary: 2 };
const lookFor = (rarity) => (rarity === 'legendary' ? 'legendary' : rarity === 'epic' ? 'premium' : 'regular');

// The quick shop under the table sells what the Shop sells, from the same table.
const QUICK_SHOP = storeItems(['pack', 'premium', 'legendary', 'coins']);
const BEST_VALUE = bestValuePackId();

const reducedMotion = () => !useGameStore.getState().animationsEnabled
  || (typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);

const CardPackOpening = ({ onClose }) => {
  const { cardPacks, premiumPacks, legendaryPacks, openCardPack, coins, gems, getNextPackType } = useGameStore();
  const buyItem = useStoreBuy();
  const [isOpening, setIsOpening] = useState(false);
  // The pull in display order (revealOrder: the best card last). The store's
  // own order is untouched; this is only the order the cards are shown in.
  const [pulledCards, setPulledCards] = useState(null);
  const [dupeCoins, setDupeCoins] = useState(0);
  const [revealed, setRevealed] = useState([]);
  // Cards in the held beat before an epic or legendary turns.
  const [charging, setCharging] = useState([]);
  // Which wave of (at most five) cards is on the table, whether it has been
  // dealt and can be turned, and whether it is all face up with more to come.
  const [wave, setWave] = useState(0);
  const [ready, setReady] = useState(false);
  const [waveDone, setWaveDone] = useState(false);
  const [pullId, setPullId] = useState(0);
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
  // burst confetti over whatever screen the player navigated to. Every reveal
  // step also carries the generation it was scheduled in, so one left over
  // from an earlier pack (or a decode that settles after close) does nothing.
  const timeoutsRef = useRef([]);
  const genRef = useRef(0);
  const track = (id) => { timeoutsRef.current.push(id); return id; };
  const later = (fn, ms) => {
    const gen = genRef.current;
    return track(setTimeout(() => { if (genRef.current === gen) fn(); }, ms));
  };
  useEffect(() => {
    const timeouts = timeoutsRef.current;
    const gen = genRef;
    return () => { gen.current += 1; timeouts.forEach(clearTimeout); };
  }, []);

  // The reveal runs on timers and taps, so its live state is mirrored in refs
  // the callbacks read (state in a timer's closure is a stale snapshot).
  const pullRef = useRef(null);
  const revealedRef = useRef([]);
  const chargingRef = useRef(new Set());
  const waveRef = useRef(0);
  const idleRef = useRef(null);
  const announcedRef = useRef(new Set());
  // The pull's art, fetched off-DOM the moment the pull is known: Image
  // objects never enter the document, so nothing about a card is on the page
  // before it turns, and holding them keeps the files in the image cache.
  const preloadRef = useRef(new Map());
  const cardEls = useRef({});
  const pendingFocusRef = useRef(false);

  const stageRef = useRef(null);
  const closeRef = useRef(null);
  const openRef = useRef(null);
  const openAnotherRef = useRef(null);
  const doneRef = useRef(null);
  const nextWaveRef = useRef(null);
  const actionsRef = useRef(null);

  // The card table's width, for the reveal's rows and zoom.
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
  const celebrateFor = (card) => {
    if (card.rarity === 'legendary' || card.rarity === 'epic') fireConfetti(card.rarity);
    else if (card.rarity === 'rare' && card.isNew) fireConfetti('rare');
  };

  const clearIdle = () => {
    if (idleRef.current) clearTimeout(idleRef.current);
    idleRef.current = null;
  };

  const setRevealedNow = (next) => { revealedRef.current = next; setRevealed(next); };
  const setChargingNow = () => setCharging([...chargingRef.current]);

  // Focus belongs to the table while a pack is revealed: on the card to turn
  // next, the Next wave control, or the table itself. Only moved while it is
  // already there (or lost to a control that just went away) — a player who
  // has Tabbed to Close keeps it.
  const focusOnTable = () => {
    const active = document.activeElement;
    return !active || active === document.body || !!stageRef.current?.contains(active);
  };

  // What happens next if the player does nothing: the next face-down card in
  // this wave turns, or the next wave is offered (then dealt), or the reveal
  // ends.
  const scheduleIdle = () => {
    clearIdle();
    const cards = pullRef.current;
    if (!cards) return;
    const ranges = waveRanges(cards.length);
    const [start, end] = ranges[waveRef.current];
    let next = -1;
    let held = false;
    for (let i = start; i < end; i++) {
      if (revealedRef.current[i]) continue;
      if (chargingRef.current.has(i)) { held = true; continue; }
      if (next === -1) next = i;
    }
    if (next !== -1) {
      idleRef.current = later(() => turn(next), IDLE_MS);
    } else if (held) {
      // A held beat is running; its flip schedules what comes after.
    } else if (waveRef.current < ranges.length - 1) {
      setWaveDone(true);
      pendingFocusRef.current = true;
      idleRef.current = later(nextWave, WAVE_IDLE_MS);
    } else {
      idleRef.current = later(() => setIsOpening(false), END_MS);
    }
  };

  // Turns a card over: by tap, by key, or by the idle fallback. An epic or
  // legendary holds a beat first, the stage lit in its tier and its light
  // brightening, so the best card lands as the moment it is.
  const turn = (i) => {
    const cards = pullRef.current;
    if (!cards || revealedRef.current[i] || chargingRef.current.has(i)) return;
    clearIdle();
    if (rankOf(cards[i]) >= EPIC) {
      chargingRef.current.add(i);
      setChargingNow();
      later(() => flip(i), BEAT_MS);
      return;
    }
    flip(i);
  };

  const flip = (i) => {
    const cards = pullRef.current;
    if (!cards || revealedRef.current[i]) return;
    const card = cards[i];
    const moveFocus = focusOnTable();
    chargingRef.current.delete(i);
    setChargingNow();
    setRevealedNow(revealedRef.current.map((v, k) => v || k === i));
    announcedRef.current.add(i);
    setAnnouncement(`${card.name}, ${card.rarity}${card.isNew ? ', new' : ''}. Card ${i + 1} of ${cards.length}.`);
    celebrateFor(card);
    // A backstop: the layout keeps every card on screen, but if the player
    // has scrolled the dialog, bring the turning card back into view.
    cardEls.current[i]?.scrollIntoView?.({ block: 'nearest', behavior: reducedMotion() ? 'auto' : 'smooth' });
    if (moveFocus) pendingFocusRef.current = true;
    scheduleIdle();
  };

  // Deals a wave onto the table. The first wave also waits (briefly, and
  // never more than ART_HOLD_MS) for the first card's art to decode, so the
  // first face to turn is never a blank gradient on a slow connection.
  const dealWave = (w, first) => {
    const cards = pullRef.current;
    waveRef.current = w;
    setWave(w);
    setReady(false);
    setWaveDone(false);
    const gen = genRef.current;
    const waits = [new Promise((resolve) => later(resolve, DEAL_MS))];
    if (first) {
      const [start] = waveRanges(cards.length)[w];
      const art = preloadRef.current.get(cards[start].id);
      waits.push(Promise.race([
        art?.decode ? art.decode().catch(() => {}) : Promise.resolve(),
        new Promise((resolve) => later(resolve, ART_HOLD_MS)),
      ]));
    }
    Promise.all(waits).then(() => {
      if (genRef.current !== gen) return;
      setReady(true);
      pendingFocusRef.current = true;
      scheduleIdle();
    });
  };

  const nextWave = () => {
    const cards = pullRef.current;
    if (!cards || waveRef.current >= waveRanges(cards.length).length - 1) return;
    clearIdle();
    dealWave(waveRef.current + 1, false);
  };

  // Everything left, face up, now: the wave on the table turns over and the
  // table moves to the last wave.
  const revealAll = () => {
    const cards = pullRef.current;
    if (!cards) return;
    clearIdle();
    const fresh = cards.filter((_, i) => !revealedRef.current[i]);
    chargingRef.current.clear();
    setChargingNow();
    setRevealedNow(cards.map(() => true));
    const last = waveRanges(cards.length).length - 1;
    waveRef.current = last;
    setWave(last);
    setWaveDone(false);
    setReady(true);
    const best = fresh.reduce((b, c) => (!b || rankOf(c) > rankOf(b) ? c : b), null);
    if (best) celebrateFor(best);
    pendingFocusRef.current = true;
    idleRef.current = later(() => setIsOpening(false), END_MS);
  };

  const handleOpenPack = () => {
    if (totalPacks <= 0 || isOpening) return;

    genRef.current += 1;
    clearIdle();
    // With Animations off a pack opens straight to its cards, face up:
    // nothing tears, nothing is dealt, nothing pulses.
    const instant = !useGameStore.getState().animationsEnabled;
    const opening = getNextPackType();
    setIsOpening(true);
    setPackAnimation(!instant);
    setPulledCards(null);
    setRevealedNow([]);
    setOpenedType(opening);
    setAnnouncement(`Opening ${opening === 'legendary' ? 'Legendary ' : opening === 'premium' ? 'Premium ' : ''}pack…`);
    // The control that was pressed unmounts now. Hold focus on the table
    // until the reveal ends, rather than letting it fall out of the dialog.
    stageRef.current?.focus({ preventScroll: true });

    later(() => {
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
      const shown = revealOrder(result.cards);
      const art = new Map();
      for (const c of shown) {
        if (art.has(c.id)) continue;
        const img = new Image();
        img.decoding = 'async';
        img.src = `/cards/thumbs/${c.id}.webp`;
        art.set(c.id, img);
      }
      preloadRef.current = art;
      pullRef.current = shown;
      announcedRef.current = new Set();
      chargingRef.current = new Set();
      setChargingNow();
      setPullId((n) => n + 1);
      setOpenedType(packType);
      setPulledCards(shown);
      setDupeCoins(result.dupeCoins);

      if (instant) {
        setRevealedNow(shown.map(() => true));
        const last = waveRanges(shown.length).length - 1;
        waveRef.current = last;
        setWave(last);
        setReady(true);
        setIsOpening(false);
        return;
      }
      setRevealedNow(shown.map(() => false));
      dealWave(0, true);
    }, instant ? 0 : TEAR_MS);
  };

  // Hand focus to whatever the reveal now asks for (see focusOnTable), once
  // the render that put it on the page has landed.
  useEffect(() => {
    if (!pendingFocusRef.current) return;
    pendingFocusRef.current = false;
    const stage = stageRef.current;
    if (!stage || !focusOnTable()) return;
    const target = stage.querySelector('button[data-turn]:not([aria-disabled="true"])') || nextWaveRef.current || stage;
    if (target !== document.activeElement) target.focus({ preventScroll: true });
  });

  // When the reveal ends, hand focus to the next thing to do (Open Another, or
  // Done), then say how it went: the summary goes after the focus move, which
  // a screen reader would otherwise speak over it. Cards that
  // were never announced one by one (Reveal all, or Animations off) are named
  // in the summary.
  const wasOpening = useRef(false);
  useEffect(() => {
    if (isOpening) { wasOpening.current = true; return; }
    if (!wasOpening.current) return;
    wasOpening.current = false;
    const keyboard = document.activeElement?.matches?.(':focus-visible') ?? false;
    const next = pulledCards ? (openAnotherRef.current || doneRef.current) : openRef.current;
    next?.focus({ preventScroll: !keyboard });
    // Whoever is watching, the way on (Open Another / Done) comes into view —
    // 'nearest', so the cards just turned stay on screen.
    if (pulledCards) actionsRef.current?.scrollIntoView?.({ block: 'nearest', behavior: reducedMotion() ? 'auto' : 'smooth' });
    if (pulledCards) {
      const fresh = pulledCards.filter(c => c.isNew).length;
      const unheard = pulledCards
        .filter((_, i) => !announcedRef.current.has(i))
        .map((c) => `${c.name}, ${c.rarity}${c.isNew ? ', new' : ''}`);
      setAnnouncement([
        `Pack opened: ${pulledCards.length} cards.`,
        unheard.length ? `${unheard.join('; ')}.` : '',
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

  const resetView = () => {
    genRef.current += 1;
    clearIdle();
    timeoutsRef.current.forEach(clearTimeout);
    timeoutsRef.current.length = 0;
    pullRef.current = null;
    chargingRef.current = new Set();
    setPulledCards(null);
    setDupeCoins(0);
    setRevealedNow([]);
    setCharging([]);
    setWave(0);
    waveRef.current = 0;
    setReady(false);
    setWaveDone(false);
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
  const ranges = pulledCards ? waveRanges(pulledCards.length) : [];
  const [waveStart, waveEnd] = ranges[wave] ?? [0, 0];
  const layout = tableLayout(waveEnd - waveStart, fieldWidth);
  const tableRows = [];
  for (let r = 0, i = waveStart; r < layout.rows.length; i += layout.rows[r], r++) {
    tableRows.push(Array.from({ length: layout.rows[r] }, (_, k) => i + k));
  }
  const allRevealed = !!pulledCards && revealed.length === pulledCards.length && revealed.every(Boolean);
  const faceDown = !!pulledCards && !allRevealed;

  const look = PACK_LOOK[nextPackType] || PACK_LOOK.regular;
  // The stage is lit by the pack being opened while it opens and is revealed
  // — brightened to the best tier turned (or about to turn) so far — and by
  // the pack on the table otherwise.
  const shownTier = pulledCards
    ? pulledCards.reduce((best, c, i) => {
      if (!revealed[i] && !charging.includes(i)) return best;
      const l = lookFor(c.rarity);
      return LOOK_RANK[l] > LOOK_RANK[best] ? l : best;
    }, openedType || 'regular')
    : null;
  const litType = ((isOpening || pulledCards) ? (shownTier || openedType) : nextPackType) || nextPackType || 'regular';
  const tierName = nextPackType === 'legendary' ? 'Legendary' : nextPackType === 'premium' ? 'Premium' : '';
  const canOpen = totalPacks > 0 && !isOpening;
  // Only the tear needs the case to clip (its flash grows to ~2.3x the pack).
  // Clipping the reveal cut the rare+ glows off in a hard line along the case
  // wall on phones and sat the legendary crown on the top edge.
  const tearing = packAnimation && showPack;

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-label="Card packs"
      // Scrolls, and the panel is pinned to the top rather than centred: the
      // shop below the table goes away while a pack opens, and a centred panel
      // would jump down the screen under the player the moment they tap Open.
      // Below 360px the three nested paddings (here, the content, the stage)
      // drop to 8px each: at 320 they took 72px of a 320px screen.
      className="fixed inset-0 z-50 dialog-scrim flex items-start justify-center p-3 max-[359px]:p-2 sm:p-6 overflow-y-auto"
    >
      <div className="relative w-full max-w-5xl rounded-2xl dialog-panel overflow-hidden">
        {/* Header. Below md the balances take their own row under the title
            and the close control: from sm they no longer fit beside a
            "Card Packs" title and the X wrapped under it. */}
        <div className="relative flex flex-wrap items-center gap-3 px-3 max-[359px]:px-2 sm:px-6 pt-4 sm:pt-5 pb-4">
          <div className="flex items-center gap-3 min-w-0 mr-auto">
            <Medallion icon={Package} />
            <h1 className="font-display text-3xl md:text-4xl font-extrabold leading-none text-brass-gradient">
              Card Packs
            </h1>
          </div>
          {/* The same wallet, in the same slot, as the Shop. */}
          <WalletChips
            className="order-last w-full md:order-none md:w-auto"
            coins={coins}
            gems={gems}
            packs={{ regular: cardPacks, premium: premiumPacks, legendary: legendaryPacks }}
          />
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

        <div className="relative px-3 max-[359px]:px-2 sm:px-6 pb-5 sm:pb-6">
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
            className={`relative isolate rounded-2xl border border-white/5 bg-night-950/55 shadow-[inset_0_2px_24px_rgba(0,0,0,0.65)] px-3 max-[359px]:px-2 py-6 sm:p-8 outline-none ${
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
                    {/* One wave at a time, in explicit balanced rows (never a
                        card alone on a row), zoomed to the measured table: CSS
                        zoom, not transform, so the cards take the room they
                        appear to — as the GameBoard's fitField does. gap-y-6:
                        the legendary crown stands 24px above its card, and in
                        a narrower gap it sat on the caption above. */}
                    <AnimatePresence mode="wait" initial={false}>
                      <motion.div
                        key={`${pullId}-${wave}`}
                        exit={{ opacity: 0, y: -16 }}
                        transition={{ duration: 0.25 }}
                        data-reveal-table=""
                        className="mx-auto flex flex-col items-center gap-y-6"
                        style={layout.zoom !== 1 ? { zoom: layout.zoom } : undefined}
                      >
                        {tableRows.map((row, r) => (
                          <div key={r} className="flex justify-center" style={{ columnGap: layout.gap }}>
                            {row.map((i) => (
                              <RevealCard
                                key={`${pullId}-${i}`}
                                card={pulledCards[i]}
                                index={i}
                                order={i - waveStart}
                                revealed={!!revealed[i]}
                                charging={charging.includes(i)}
                                ready={ready && isOpening}
                                settled={!isOpening}
                                onTurn={turn}
                                cardRef={(el) => { cardEls.current[i] = el; }}
                              />
                            ))}
                          </div>
                        ))}
                      </motion.div>
                    </AnimatePresence>

                    {/* A ten-card pack is dealt in two waves; afterwards either
                        can be put back on the table. */}
                    {!isOpening && ranges.length > 1 && (
                      <div className="mt-6 flex justify-center">
                        <div role="group" aria-label="Cards on the table" className="seg-well inline-flex gap-1">
                          {ranges.map(([start, end], w) => (
                            <button
                              key={start}
                              type="button"
                              aria-pressed={wave === w}
                              onClick={() => { waveRef.current = w; setWave(w); }}
                              className={`rounded-lg px-3 py-1.5 font-display font-bold text-sm tabular-nums ${FOCUS_OUTLINE} ${
                                wave === w ? 'seg-on' : 'seg-off'
                              }`}
                            >
                              {`Cards ${start + 1}–${end}`}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* One chip, wrapping inside itself: as two stacked chips at
                        320px the summary pushed Done off the bottom. */}
                    {allRevealed && !isOpening && (newCardsCount > 0 || dupeCoins > 0) && (
                      <motion.div
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="mt-6 flex justify-center"
                      >
                        <div className="panel-glass rounded-xl px-3.5 py-2 inline-flex flex-wrap items-center justify-center gap-x-4 gap-y-1 font-display font-bold text-sm sm:text-base">
                          {newCardsCount > 0 && (
                            <span className="inline-flex items-center gap-2 text-emerald-300">
                              <PartyPopper aria-hidden="true" className="w-5 h-5 shrink-0" strokeWidth={2.2} />
                              {newCardsCount} new card{newCardsCount > 1 ? 's' : ''} for your collection
                            </span>
                          )}
                          {dupeCoins > 0 && (
                            <span className="inline-flex items-center gap-2 text-brass-300">
                              <Coins aria-hidden="true" className="w-5 h-5 shrink-0" strokeWidth={2.2} />
                              +{dupeCoins} coins for duplicates
                            </span>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Actions */}
            <div ref={actionsRef} className="flex flex-wrap justify-center gap-3 mt-7 min-h-11 scroll-mb-3">
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

              {/* Mid-reveal: deal the next wave, or turn everything now. */}
              {pulledCards && isOpening && waveDone && (
                <button
                  ref={nextWaveRef}
                  type="button"
                  onClick={nextWave}
                  className={`${ACTION} btn-glass px-6 text-base`}
                >
                  {`Next ${(ranges[wave + 1]?.[1] ?? 0) - (ranges[wave + 1]?.[0] ?? 0)}`}
                </button>
              )}
              {pulledCards && isOpening && faceDown && (
                <button type="button" onClick={revealAll} className={`${ACTION} btn-glass px-6 text-base`}>
                  Reveal all
                </button>
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
              <SectionHeading>Shop</SectionHeading>
              {/* Every item the Shop sells for packs or coins, through the
                  Shop's own tile. Eight cells for seven items: the BEST VALUE
                  tile is two wide, so the grid comes out in whole rows (of 2,
                  then 4) instead of leaving one tile alone on the last. Not 8
                  across at lg: in a 112px tile "Need 144 more" ran out of the
                  pill. */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3">
                {QUICK_SHOP.map((item) => (
                  <StoreTile
                    key={item.id}
                    item={item}
                    variant="compact"
                    bestValue={item.id === BEST_VALUE}
                    className={item.id === BEST_VALUE ? 'col-span-2' : ''}
                    onBuy={buyItem}
                  />
                ))}
              </div>
            </div>
          )}

          {/* The odds, rendered from PACK_ODDS — every tier, since two are
              sold for gems. */}
          <div className="mt-6">
            <PackOddsGuide />
          </div>
        </div>
      </div>
    </div>
  );
};

// The light a face-down rare-or-better card sits in (index.css .reveal-tease),
// in its tier's colour, and the colour named for a screen reader: the tease is
// what a sighted player sees, so it is what the button says.
const TEASE = {
  rare: { light: 'rgba(56, 189, 248, 0.8)', name: 'blue' },
  epic: { light: 'rgba(192, 132, 252, 0.85)', name: 'purple' },
  legendary: { light: 'rgba(251, 191, 36, 0.9)', name: 'gold' },
};

// One card of the reveal. It is dealt onto the table face down, then turns
// over when the player turns it (or the idle timer does): a real two-faced
// flip (each face hides its back), so the front is never seen mirrored. The
// face is only mounted once revealed, so nothing about the card — its name,
// its art — is in the DOM before the player sees it. A face-down rare or
// better does sit in a faint light of its tier: the tease is deliberate, and
// it is all the table gives away. Everything here is a one-shot animation on
// transform/opacity, apart from the tease's CSS breathing.
//
// Face down and dealt, the card is a real button over the card back, so a tap
// or a key turns it. The back stays mounted under the face for the flip, so it
// is aria-hidden: backface-visibility hides it from the eye only, and its 🧸
// prefixed every revealed card with "teddy bear" for a screen reader.
//
// `settled` is a card put back on the table after the reveal (the other wave
// of a ten-card pack, or the whole pack with Animations off): no deal, no
// burst of light, just the card.
const RevealCard = ({ card, index, order, revealed, charging, ready, settled, onTurn, cardRef }) => {
  const r = RARITY[card.rarity];
  const rank = RARITY_ORDER.indexOf(card.rarity);
  const tease = !revealed && rank >= RARE ? TEASE[card.rarity] : null;
  return (
    <motion.div
      initial={settled ? false : { opacity: 0, y: -40, scale: 0.7 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ delay: order * 0.05, type: 'spring', stiffness: 260, damping: 24 }}
      className="flex flex-col items-center gap-1.5"
    >
      <div ref={cardRef} data-reveal-card={revealed ? 'up' : 'down'} className="group relative w-24 h-36">
        {tease && (
          <div
            aria-hidden="true"
            data-tease={card.rarity}
            data-charged={charging ? '' : undefined}
            // Solid to just inside the card's edge, so what shows round the
            // back is a ring of light rather than the last whisper of a fade.
            className="reveal-tease pointer-events-none absolute -inset-6 rounded-[36px]"
            style={{ background: `radial-gradient(closest-side, ${tease.light} 60%, transparent)` }}
          />
        )}
        {/* Rare and up turn over into their own light. */}
        {revealed && rank >= RARE && (
          <motion.div
            aria-hidden="true"
            initial={settled ? false : { opacity: 0, scale: 0.6 }}
            animate={settled
              ? { opacity: rank >= EPIC ? 0.7 : 0.45, scale: 1 }
              : { opacity: [0, 1, rank >= EPIC ? 0.7 : 0.45], scale: [0.6, 1.2, 1] }}
            transition={{ duration: 0.8, times: [0, 0.4, 1] }}
            className={`absolute -inset-3 rounded-2xl blur-xl bg-gradient-to-br ${r.gradient}`}
          />
        )}
        {/* A plain wrapper takes the hover lift: Framer Motion owns the
            transform of the flip inside it. */}
        <div className={`relative w-24 h-36 transition-transform duration-200 ${!revealed && ready ? 'group-hover:-translate-y-1' : ''}`}>
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
                <TeddyCard teddy={card} artLoading="eager" />
              </div>
            )}
          </motion.div>
        </div>
        {!revealed && ready && (
          <button
            type="button"
            data-turn=""
            onClick={() => onTurn(index)}
            // In the held beat it is already turning: still the same control
            // (focus stays put), but not one that does anything more.
            aria-disabled={charging ? 'true' : undefined}
            aria-label={`Turn over card ${index + 1}${tease ? `, glowing ${tease.name}` : ''}`}
            className={`absolute inset-0 rounded-lg ${charging ? 'cursor-default' : 'cursor-pointer'} ${FOCUS_OUTLINE}`}
          />
        )}
        {!revealed && !ready && <span className="sr-only">Face-down card</span>}
        {revealed && card.isNew && (
          <motion.div
            initial={settled ? false : { scale: 0, opacity: 0 }}
            animate={settled ? { scale: 1, opacity: 1 } : { scale: [0, 1.25, 1], opacity: 1 }}
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
              initial={settled ? false : { opacity: 0, y: -10, scale: 0.5 }}
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
        transition={{ delay: revealed && !settled ? 0.3 : 0, duration: 0.25 }}
        className={`label-caps text-[10px] leading-3 h-3 ${r.text}`}
      >
        {revealed ? card.rarity : ''}
      </motion.span>
    </motion.div>
  );
};

export default CardPackOpening;
