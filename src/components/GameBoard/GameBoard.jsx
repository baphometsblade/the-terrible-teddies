import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Coins, Crosshair, Flag, Ghost, Heart, HeartCrack, ScrollText, Shield, Smartphone, Star, Trophy, Volume2, VolumeX, Zap,
} from 'lucide-react';
import TeddyCard, { CardBack } from '../TeddyCard';
import { Progress } from "@/components/ui/progress";
import { RARITY_METAL } from '@/lib/rarity';
import { useToast } from "@/components/ui/use-toast";
import { motion, AnimatePresence, useIsPresent } from 'framer-motion';
import { playSound as playSoundEffect } from '@/utils/sounds';
import { useGameStore, ALL_CARDS } from '../../stores/gameStore';
import { celebrate } from '@/lib/celebrate';
import { resolveCreatureHit, rallyField, effectiveCost, effectiveAttack, canAttack, readyCreatures, gainedFuryStack, getValidTargets, describeBlockedTarget } from '../../utils/battleUtils';
import { pickQuip, OPPONENT_NAME } from '../../utils/teddyTalk';
import { syncBattleResult, syncPlayerLevel } from '../../utils/supabaseClient';
import { chooseOpponentPlays, chooseAttackTarget, OPPONENT_ENERGY_BY_DIFFICULTY } from '../../utils/opponentAI';
import { buildOpponentDeck, OPPONENT_HEALTH_MOD_BY_DIFFICULTY } from '../../utils/opponentDeck';
import { pressable } from '@/lib/a11y';
import { useDialog } from '@/hooks/useDialog';
import { bestOwnedBorder, ownedEmotes } from '@/lib/cosmetics';

// Cap the hand so unbounded draw (per-turn + draw specials) can't overflow the
// fixed-width hand layout into an unclickable, off-screen stack.
const MAX_HAND_SIZE = 10;

// Stamp a creature's starting durability when it enters the field. `defense` is
// the HP pool in the creature-HP combat model; `currentHp` tracks the remaining
// pool as it takes hits (see resolveCreatureHit).
const withHp = (card) => ({ ...card, currentHp: card.defense });

// A full momentum gauge unlocks the Rally payoff.
const MOMENTUM_MAX = 10;

// Board metals. Brass is the player's (and the plaque on their turn); crimson
// is Chuck's.
const PLAQUE_BRASS = 'linear-gradient(180deg, #fde68a 0%, #fbbf24 45%, #d97706 100%)';
const PLAQUE_CRIMSON = 'linear-gradient(180deg, #ef4444 0%, #b91c1c 50%, #7f1d1d 100%)';
const OPPONENT_RING = 'linear-gradient(145deg, #fecaca 0%, #b91c1c 40%, #f87171 65%, #7f1d1d 100%)';

// Shared shape of every board control; the material (btn-brass / btn-glass)
// is added per button. Plain <button>s rather than the shadcn Button, whose
// bg-primary is a utility and would beat a component-layer material.
const ACTION =
  'inline-flex items-center justify-center gap-1.5 h-10 px-4 md:w-full rounded-xl font-display font-bold ' +
  'text-sm sm:text-base whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 ' +
  'focus-visible:ring-brass-300 focus-visible:ring-offset-2 focus-visible:ring-offset-night-950';

const Avatar = ({ ring }) => (
  <div
    className="h-10 w-10 shrink-0 rounded-full p-[2px] shadow-[0_4px_12px_-4px_rgba(0,0,0,0.8)]"
    style={{ background: ring }}
    aria-hidden="true"
  >
    <div className="flex h-full w-full items-center justify-center rounded-full bg-night-900 text-xl">🧸</div>
  </div>
);

// How long a combat effect (a floating number, a shake, a flash) lives.
const FX_MS = 1150;

// How a creature leaves the table: it crumples and drops away toward its own
// side. Framer Motion (it owns these cards' transforms), so MotionConfig's
// reduced motion turns it into a plain fade.
const CRUMPLE_PLAYER = { opacity: 0, scale: 0.6, rotate: 8, y: 24, filter: 'grayscale(1) brightness(0.6)', transition: { duration: 0.45, ease: [0.4, 0, 0.6, 1] } };
const CRUMPLE_CHUCK = { opacity: 0, scale: 0.6, rotate: -8, y: -24, filter: 'grayscale(1) brightness(0.6)', transition: { duration: 0.45, ease: [0.4, 0, 0.6, 1] } };

// A floating number: "−3" over a struck card, "+5" over a healed face. Pure
// decoration — the battle log is the accessible record of every hit — and the
// motion is CSS (index.css, .fx-float), so it stops with the Animations
// switch and reduced motion.
const FX_TONE = {
  damage: 'text-red-300',
  heal: 'text-emerald-300',
  buff: 'text-brass-200',
};
const FloatNumber = ({ fx, style, className = '' }) => (
  <span
    className={`fx-float font-display text-[26px] font-extrabold leading-none tabular-nums ${FX_TONE[fx.tone] ?? FX_TONE.damage} ${className}`}
    style={{ '--fx-i': fx.stack ?? 0, ...style }}
  >
    {fx.text}
  </span>
);

const HealthMeter = ({ hp, max, fill, label, fx = [], drift = 'up' }) => (
  // fx: this side's face events. A hit shakes the meter and floats the
  // number off it, toward the table (down from Chuck's rail, up from yours).
  <div className={`relative flex flex-col items-end gap-1 ${fx.some((e) => e.tone === 'damage') ? 'fx-hit' : ''}`}>
    {fx.length > 0 && (
      <span aria-hidden="true" className={`pointer-events-none absolute right-6 z-30 ${drift === 'down' ? 'top-full mt-1 fx-drift-down' : 'bottom-full mb-1'}`}>
        {fx.map((e, i) => (
          <FloatNumber key={e.id} fx={{ ...e, stack: i }} className="absolute right-0" />
        ))}
      </span>
    )}
    <div className="flex items-center gap-1.5 leading-none">
      <Heart className="h-3.5 w-3.5 text-red-400" fill="currentColor" aria-hidden="true" />
      {/* key-remount replays the pop on every HP change, so each hit reads. */}
      <motion.span
        key={hp}
        initial={{ scale: 1.6, color: '#fca5a5' }}
        animate={{ scale: 1, color: '#ece6f2' }}
        transition={{ type: 'spring', stiffness: 400, damping: 14 }}
        className="inline-block font-display text-lg sm:text-xl font-extrabold tabular-nums whitespace-nowrap"
      >
        {hp}/{max}
      </motion.span>
    </div>
    <Progress
      value={(hp / max) * 100}
      className={`h-2 w-20 sm:w-36 bg-black/45 ring-1 ring-white/10 ${fill}`}
      aria-label={label}
    />
  </div>
);

// A creature on the table. AnimatePresence keeps a card that has just left
// the field (killed, or a trap that sprang) on screen for its crumple-away
// exit; for those few hundred milliseconds it must stop being a control, or a
// tap could act on a card the game has already removed. useIsPresent is false
// while it exits.
// It also drops the valid-target marker it was last drawn with: an exiting
// card renders with its final props, and a creature killed while targeted
// would otherwise go on advertising itself as something to hit.
const FieldSlot = ({ press, className = '', children, ...motionProps }) => {
  const present = useIsPresent();
  const cls = present ? className : `${className.replace('cursor-crosshair', '')} pointer-events-none`;
  return (
    <motion.div {...motionProps} className={cls} {...(present ? press : {})}>
      {children}
    </motion.div>
  );
};

// Ten segments rather than a bar, so "two more hits to Rally" is countable at a
// glance. The ring glows (CSS pulse, compositor-only) once it is full, unless
// `glow` is off — at game over, so nothing animates under the result dialog.
const MomentumMeter = ({ value, glow = true }) => {
  const full = value >= MOMENTUM_MAX;
  return (
    <div
      className="relative shrink-0 w-[6.5rem] sm:w-32"
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={MOMENTUM_MAX}
      aria-valuenow={value}
      aria-label={`Momentum: ${value} of ${MOMENTUM_MAX}`}
    >
      <div className="flex items-baseline justify-between" aria-hidden="true">
        <span className="label-caps text-[9px] text-brass-300">Momentum</span>
        <span className="text-[10px] font-bold tabular-nums text-brass-200">{value}/{MOMENTUM_MAX}</span>
      </div>
      <div className="mt-1 flex gap-[3px]" aria-hidden="true">
        {Array.from({ length: MOMENTUM_MAX }, (_, i) => (
          <span
            key={i}
            className={`h-1.5 flex-1 rounded-full ${i < value
              ? 'bg-gradient-to-b from-brass-200 to-brass-400 shadow-[0_0_6px_rgba(251,191,36,0.6)]'
              : 'bg-black/45 ring-1 ring-inset ring-white/5'}`}
          />
        ))}
      </div>
      {full && glow && (
        <span
          className="absolute -inset-1.5 rounded-lg ring-1 ring-brass-300/70 shadow-[0_0_14px_rgba(251,191,36,0.5)] motion-safe:animate-pulse pointer-events-none"
          aria-hidden="true"
        />
      )}
    </div>
  );
};

// A field row's footprint at zoom 1, which the board scales to fit the felt:
// a card (h-36) plus its status slot (mt-1.5 + 18px), and per card a w-24
// slot with the sm gap between them.
const FIELD_ROW_HEIGHT = 144 + 6 + 18;
const FIELD_SLOT = 96;
const FIELD_GAP = 12;

// The space under a creature for "Warming Up" / "Exhausted", reserved whether
// or not a chip shows, so a row keeps one height whatever states it shows.
// The e2e suite counts those words exactly, so each state renders them in a
// StatusChip and nowhere else.
const StatusSlot = ({ children }) => (
  <div className="mt-1.5 flex h-[18px] justify-center">{children}</div>
);
const StatusChip = ({ children }) => (
  <span className="rounded-full bg-night-950/85 ring-1 ring-white/10 px-2 py-0.5 text-[10px] leading-[14px] font-semibold text-plush-200 whitespace-nowrap">
    {children}
  </span>
);

const StealthBand = () => (
  <div className="absolute inset-x-0 top-[22px] z-10 flex items-center justify-center gap-1 bg-purple-700/90 py-0.5 text-[9px] font-bold tracking-[0.12em] text-white">
    <Ghost className="h-2.5 w-2.5" aria-hidden="true" />
    STEALTH
  </div>
);

const TauntTag = ({ tone }) => (
  <div
    className={`absolute -top-2.5 left-1/2 -translate-x-1/2 z-10 flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-extrabold tracking-[0.12em] shadow-[0_3px_8px_-2px_rgba(0,0,0,0.8)] ${tone === 'opponent'
      ? 'bg-red-700 text-white'
      : 'bg-brass-300 text-night-950'}`}
  >
    <Shield className="h-2.5 w-2.5" aria-hidden="true" />
    TAUNT
  </div>
);

// Push the player's current level/xp to the server on the leaderboard's
// experience scale. Fire-and-forget; syncPlayerLevel no-ops when signed out.
// Reads live store state (not a hook) so it's safe to call from effects without
// threading level/xp through dependency arrays.
function syncLevelToServer() {
  const state = useGameStore.getState();
  // ownerUserId is this account's id (bindToUser stamps it at login), so the
  // helper can skip its auth.getUser() round-trip.
  syncPlayerLevel(state.level, state.getLeaderboardExperience(), state.ownerUserId)
    .catch(err => console.error('Level sync failed:', err));
}

// The game-over overlay mounts conditionally, so it hosts its own useDialog
// (the hook must live in a component that mounts with the overlay). Gives the
// end screen dialog semantics + focus containment, so keyboard users can't
// tab into the finished board behind it.
const GameOverDialog = ({ label, onEscape, children }) => {
  const ref = useDialog(onEscape);
  return (
    <motion.div
      ref={ref}
      role="dialog"
      aria-modal="true"
      aria-label={label}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      // Scrolls, with the panel centred by my-auto rather than items-center:
      // a centred flex item taller than its box overflows at both ends, and on
      // a landscape phone that put Play Again and Menu out of reach.
      className="absolute inset-0 z-50 dialog-scrim flex items-start justify-center overflow-y-auto p-4"
    >
      {children}
    </motion.div>
  );
};

/**
 * Enhanced GameBoard with card abilities, sound effects, and improved AI.
 *
 * Combat model: a creature's `defense` is its HP pool (tracked per board
 * instance as `currentHp`). An attack deals the attacker's `attack` to that
 * pool; the creature survives a non-lethal hit and only dies when HP hits 0,
 * at which point trample overkill spills to the owner's face. Both sides
 * resolve identically via resolveCreatureHit.
 *
 * Card Abilities:
 * - taunt: Forces enemies to attack this card first
 * - piercing: Cuts through shield (deals full damage)
 * - shield: Takes 50% less damage (halved, floored)
 * - stealth: Can't be targeted for one turn after played
 * - protect: Other cards can't be targeted while this is on field
 * - fury: Gains +1 attack each time it survives a hit, capped at +3 total
 * - swarm: Costs 1 less energy (min 1) once you control another creature
 * - royal: Aura — other creatures you control get +1 attack while it's on the field
 */
const GameBoard = ({ onBackToMenu, onOpenShop }) => {
  // Get store data
  const {
    currentDeck,
    difficulty: aiDifficulty,
    soundEnabled: storeSoundEnabled,
    recordBattleResult,
    playerName,
    gems,
    cardPacks,
    unlockedCosmetics,
  } = useGameStore();

  // Battle Pass cosmetics: premium card frames on the player's own cards (never
  // Chuck's), and unlocked table emotes. Pure derivations, cheap per render.
  const cosmeticBorder = bestOwnedBorder(unlockedCosmetics);
  const emotes = ownedEmotes(unlockedCosmetics);

  // Accumulate per-game stats for challenge/achievement tracking
  // damageTaken is what the 'Flawless' achievement actually means. Final HP
  // can't answer it: heal is capped at 30, so a player who gets hit and then
  // heals back finishes at full and would have claimed "Win without losing HP".
  const battleStatsRef = useRef({ damageDealt: 0, healingDone: 0, cardsPlayed: 0, damageTaken: 0 });

  // Track timeouts so queued turn steps can be cancelled on restart/concede/
  // game-over/unmount, instead of firing later and mutating a fresh game.
  const timeoutsRef = useRef([]);
  const safeTimeout = useCallback((fn, delay) => {
    const id = setTimeout(fn, delay);
    timeoutsRef.current.push(id);
    return id;
  }, []);
  const clearAllTimeouts = useCallback(() => {
    timeoutsRef.current.forEach(clearTimeout);
    // Clear in place so the unmount cleanup's captured reference stays valid.
    timeoutsRef.current.length = 0;
  }, []);

  useEffect(() => {
    // Capture the array reference so the cleanup clears the same list we push
    // into (it's mutated in place, never reassigned), satisfying the rule that
    // warns against reading a possibly-changed ref in cleanup.
    const timeouts = timeoutsRef.current;
    return () => {
      timeouts.forEach(clearTimeout);
    };
  }, []);

  // Game state
  const [gameId, setGameId] = useState(0); // Used to trigger deck re-initialization on restart
  // False until the deck-init effect has dealt the opening hand, so the draw
  // phase never runs against the pre-initialization empty deck.
  const [deckReady, setDeckReady] = useState(false);
  const [phase, setPhase] = useState('draw');
  const [currentTurn, setCurrentTurn] = useState('player');
  const [turnCount, setTurnCount] = useState(1);

  // Player state
  const [playerHealth, setPlayerHealth] = useState(30);
  const [playerEnergy, setPlayerEnergy] = useState(3);
  const [playerMomentum, setPlayerMomentum] = useState(0);
  const [playerHand, setPlayerHand] = useState([]);
  const [playerField, setPlayerField] = useState([]);
  const [playerDeck, setPlayerDeck] = useState([]);

  // Opponent state
  const [opponentHealth, setOpponentHealth] = useState(30);
  // Chuck's starting HP is difficulty-scaled (hard adds +5), so the bar's
  // denominator has to travel with it. Hardcoding 30 made hard render "35/30"
  // at 117% — and Radix rejects a value above max by logging an error AND
  // falling back to null, which silently drops the aria-valuenow the
  // accessibility pass added and reports the bar as indeterminate.
  const [opponentMaxHealth, setOpponentMaxHealth] = useState(30);
  const [opponentField, setOpponentField] = useState([]);
  const [opponentDeck, setOpponentDeck] = useState([]);

  // UI state
  const [selectedCard, setSelectedCard] = useState(null);
  const [targetingMode, setTargetingMode] = useState(false);
  const [battleLog, setBattleLog] = useState([]);
  const [gameOver, setGameOver] = useState(false);
  const [winner, setWinner] = useState(null);
  const [showAbilityPopup, setShowAbilityPopup] = useState(null);
  const [battleRewards, setBattleRewards] = useState({ xp: 0, coins: 0 });

  // Chuck's trash talk: a transient speech bubble ({id, text}) plus his parting
  // shot on the game-over screen. Decorative flavor — aria-hidden, the battle
  // log stays the accessible record.
  const [oppQuip, setOppQuip] = useState(null);
  const [endQuip, setEndQuip] = useState(null);
  const quipIdRef = useRef(0);
  const lastQuipRef = useRef(null);
  const nearDeathQuippedRef = useRef(false);

  // Snapshot of the in-progress state for the unmount handler below — a cleanup
  // closes over its mount-time values, so it must read the latest through a ref.
  const liveRef = useRef({ gameOver, deckReady, playerHealth });
  liveRef.current = { gameOver, deckReady, playerHealth };

  // Leaving a battle mid-game counts as a loss. The "← Menu" control lives in
  // App, outside this component, so abandoning simply unmounts the board — with
  // no result recorded, a player could bail out of a losing game and keep their
  // win streak intact. Record the loss on unmount, but only for a battle that
  // was actually joined (deckReady) and isn't already resolved (gameOver) — a
  // finished game recorded its own result, and the `deckReady` gate also makes
  // this inert under React 18 StrictMode's mount→unmount→remount in dev, where
  // the opening hand hasn't been dealt yet at the throwaway cleanup.
  const abandonHandledRef = useRef(false);
  // The xp/coins the abandonment loss actually granted, so a bfcache-restored
  // defeat screen can show real figures instead of zeros.
  const abandonRewardsRef = useRef(null);
  useEffect(() => {
    // Empty deps + reading the action through getState() means this effect never
    // re-runs, so it only tears down on a genuine unmount — never mid-battle
    // because a dependency changed.
    const recordAbandonment = () => {
      const { gameOver: over, deckReady: ready, playerHealth: hp } = liveRef.current;
      if (over || !ready || abandonHandledRef.current) return;
      abandonHandledRef.current = true;
      const stats = battleStatsRef.current;
      // The local record persists synchronously through the store — that is what
      // closes the streak exploit even mid-unload. The server syncs are best-effort.
      abandonRewardsRef.current = useGameStore.getState()
        .recordBattleResult(false, stats.damageDealt, stats.healingDone, hp, stats.cardsPlayed);
      // The coins actually granted, not a hardcoded 5. recordBattleResult
      // returns what it credited, which is 10 rather than 5 while the Coin
      // Doubler is active — and sync_battle_result does
      // `coins = coins + GREATEST(p_coins_earned, 0)`, so passing the literal
      // drifted the server total 5 low on every abandoned battle. Both
      // non-abandon call sites already pass their real coinsGain.
      const abandonCoins = abandonRewardsRef.current?.coinsGain ?? 5;
      syncBattleResult(false, stats.damageDealt, stats.healingDone, abandonCoins, useGameStore.getState().ownerUserId)
        .catch(err => console.error('Abandon sync failed:', err));
      syncLevelToServer();
    };
    // Back/forward-cache restore. pagehide fires when the page ENTERS bfcache
    // too (pagehide listeners never block caching), so the loss above is
    // recorded — and then the browser can restore this exact component state,
    // mid-battle, gameOver still false. Without reconciliation, finishing that
    // restored battle would book a SECOND result for the same game (the
    // game-over effect checks only health). Settle the restored battle as the
    // defeat that was already recorded: setGameOver(true) makes the game-over
    // effect a permanent no-op (it early-returns on gameOver), so one battle
    // can never record twice.
    const onPageShow = (e) => {
      if (!e.persisted || !abandonHandledRef.current) return;
      if (liveRef.current.gameOver) return;
      clearAllTimeouts();
      setOppQuip(null);
      setPlayerQuip(null);
      setEndQuip(pickQuip('oppWins'));
      if (abandonRewardsRef.current) {
        setBattleRewards({ xp: abandonRewardsRef.current.xpGain, coins: abandonRewardsRef.current.coinsGain });
      }
      setWinner('opponent');
      setGameOver(true);
    };
    // pagehide covers reload / tab-close / cross-document navigation — the cases
    // where React effect cleanups do NOT run, so the unmount path alone would
    // miss them and a losing game could be dropped (F5) with the streak intact.
    // Battle state is component-local, not persisted, so nothing else records it.
    window.addEventListener('pagehide', recordAbandonment);
    window.addEventListener('pageshow', onPageShow);
    // Unmount — e.g. the "← Menu" SPA button, which does NOT fire pagehide.
    // abandonHandledRef makes the two paths mutually idempotent.
    return () => {
      window.removeEventListener('pagehide', recordAbandonment);
      window.removeEventListener('pageshow', onPageShow);
      recordAbandonment();
    };
    // clearAllTimeouts is a stable [] useCallback, so this still runs once.
  }, [clearAllTimeouts]);

  // Player-side emote bubble (Battle Pass emote cosmetics). Mirrors Chuck's
  // quip bubble: decorative and aria-hidden, with the battle log carrying the
  // accessible record of every emote.
  const [playerQuip, setPlayerQuip] = useState(null);
  const playerQuipIdRef = useRef(0);
  const lastEmoteAtRef = useRef(0);
  const sendEmote = (emote) => {
    // Small cooldown so mashing the button can't spam confetti/bubbles.
    const now = Date.now();
    if (now - lastEmoteAtRef.current < 2500) return;
    lastEmoteAtRef.current = now;

    if (emote.effect === 'confetti') {
      celebrate({ particleCount: 90, spread: 75, origin: { y: 0.75 } });
      addToBattleLog('🎉 You fire the confetti cannon. Chuck is unimpressed but covered in glitter.');
      return;
    }
    const text = pickQuip('playerEmote', playerQuip?.text ?? null);
    if (!text) return;
    const id = ++playerQuipIdRef.current;
    setPlayerQuip({ id, text });
    addToBattleLog(`🎭 You: "${text}"`);
    safeTimeout(() => {
      setPlayerQuip((q) => (q && q.id === id ? null : q));
    }, 3500);
  };

  const speak = useCallback((pool) => {
    const text = pickQuip(pool, lastQuipRef.current);
    if (!text) return;
    lastQuipRef.current = text;
    const id = ++quipIdRef.current;
    setOppQuip({ id, text });
    // Dismiss via the tracked-timeout system so restart/concede/unmount cancel
    // it; only clear if a newer quip hasn't already replaced this one.
    safeTimeout(() => {
      setOppQuip((q) => (q && q.id === id ? null : q));
    }, 3200);
  }, [safeTimeout]);

  // Combat feedback. Each event is a short-lived record of something that
  // just happened on the table — an attacker striking, a card taking a hit or
  // dying, a face hit or a heal — that the render turns into a strike, a shake
  // and flash, a crumple, a floating number. Decorative: the battle log (and
  // its live region) is the accessible record of the same events.
  //
  // A card event captures where the card is ON SCREEN at the moment it fires,
  // and its number is drawn in a layer over the felt rather than inside the
  // card. That is what lets a kill show its number: a creature that dies
  // leaves the field in the same update that records the hit, so a number
  // drawn inside the card would never render, while the card itself stays in
  // place for its exit animation (AnimatePresence), right under the number.
  // No game state waits on any of this.
  const feltRef = useRef(null);
  const centreRef = useRef(null);
  const cardEls = useRef(new Map());
  const cardRef = useCallback((id) => (el) => {
    if (el) cardEls.current.set(id, el);
    else cardEls.current.delete(id);
  }, []);
  const [fx, setFx] = useState([]);
  const fxIdRef = useRef(0);
  const pushFx = useCallback((events) => {
    if (!events.length) return;
    const felt = feltRef.current?.getBoundingClientRect();
    const perCard = new Map();
    const stamped = events.map((e) => {
      let pos = null;
      const el = e.card ? cardEls.current.get(e.card) : null;
      if (el && felt) {
        const r = el.getBoundingClientRect();
        pos = { x: r.left - felt.left + r.width / 2, y: r.top - felt.top + r.height * 0.42 };
      }
      // Several numbers on one card in one wave stack rather than overlap.
      const stack = e.text && e.card ? (perCard.get(e.card) ?? 0) : 0;
      if (e.text && e.card) perCard.set(e.card, stack + 1);
      return { ...e, id: ++fxIdRef.current, pos, stack };
    });
    setFx((prev) => [...prev, ...stamped]);
    const ids = new Set(stamped.map((e) => e.id));
    safeTimeout(() => setFx((prev) => prev.filter((e) => !ids.has(e.id))), FX_MS);
  }, [safeTimeout]);


  // Battle callouts stay up as long as they take to read, not Radix's flat five
  // seconds: a toast parked on the table's centre line for 5 s sits through
  // the next play, while the rule explanations ("Still finding the floor —
  // …") run to twenty words and are not written to the battle log, so cutting
  // every toast to one short duration lost them. About 55 ms a character plus
  // a second to notice, between 2.6 s and 7 s.
  const { toast: notify, dismiss: dismissToasts } = useToast();
  const toast = useCallback((t) => {
    const chars = `${t.title ?? ''} ${t.description ?? ''}`.length;
    return notify({ duration: Math.min(7000, Math.max(2600, 1000 + 55 * chars)), ...t });
  }, [notify]);

  // The turn banner: "Your turn" / "Chuck's turn" across the felt at each turn
  // boundary and at the start of a game, so the hand-over reads at a glance.
  // Decorative (the log announces whose turn it is) and never in the way of a
  // tap. Cleared at game over, when the result dialog takes the table.
  const [banner, setBanner] = useState(null);
  const bannerIdRef = useRef(0);
  useEffect(() => {
    if (gameOver) {
      setBanner(null);
      return undefined;
    }
    if (!deckReady) return undefined;
    const id = ++bannerIdRef.current;
    setBanner({ id, turn: currentTurn });
    // A turn boundary retires the last turn's callouts: on phones a toast
    // shares the centre line with the banner and would sit on top of it.
    dismissToasts();
    const timer = setTimeout(() => setBanner((b) => (b?.id === id ? null : b)), 1300);
    return () => clearTimeout(timer);
  }, [currentTurn, deckReady, gameOver, dismissToasts]);

  // While a battle is in play, notifications move off the turn controls (see
  // index.css): in their usual corner they covered the controls on desktop
  // and Chuck's health on phones. At game over any open toast is dismissed
  // rather than left to jump back to that corner over the result dialog,
  // which says everything anyway.
  useEffect(() => {
    if (gameOver) {
      dismissToasts();
      return undefined;
    }
    const root = document.documentElement;
    root.dataset.screen = 'battle';
    return () => { delete root.dataset.screen; };
  }, [gameOver, dismissToasts]);

  // Play sound helper
  const playSound = useCallback((soundName) => {
    playSoundEffect(soundName, storeSoundEnabled);
  }, [storeSoundEnabled]);

  // Shuffle deck helper
  const shuffleDeck = (deck) => {
    const shuffled = [...deck];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  };

  // Add to battle log. Ids must be unique — several entries are appended in
  // the same millisecond during the opponent's turn, so Date.now() collides
  // and duplicate React keys corrupt the rendered list.
  const logIdRef = useRef(0);
  const addToBattleLog = useCallback((message) => {
    // Capture the id now — reading the ref inside the updater would give two
    // batched updates the same (final) value and recreate the duplicate keys.
    logIdRef.current += 1;
    const id = logIdRef.current;
    setBattleLog(prev => [...prev.slice(-9), { id, message }]);
  }, []);

  // Initialize decks
  useEffect(() => {
    // Build player deck from store's currentDeck (card IDs mapped to ALL_CARDS)
    const playerDeckCards = currentDeck
      .map(cardId => ALL_CARDS.find(c => c.id === cardId))
      .filter(Boolean)
      .map((card, idx) => ({ ...card, instanceId: `p-${card.id}-${idx}` }));

    // Fallback if no deck is set — the starter ten, resolved from ALL_CARDS
    // by name so ids, stats, rarities (and shipped card art) stay canonical.
    const starterNames = [
      "Shitstarter Ted", "Shit-Talk Sally", "Honey Trap", "Emergency Fluff Job",
      "Shiv-in-a-Pillow", "Chokehold Cuddles", "Peeping Pete", "Honey on the Rocks",
      "The F-Bomb", "Restraining-Order Randy",
    ];
    const deckToUse = playerDeckCards.length >= 5
      ? playerDeckCards
      : starterNames
          .map(name => ALL_CARDS.find(c => c.name === name))
          .filter(Boolean)
          .map((card, idx) => ({ ...card, instanceId: `p-${card.id}-${idx}` }));

    const initialPlayerDeck = shuffleDeck(deckToUse);

    // Generate opponent deck based on difficulty — a fresh crew every fight,
    // scaled by difficulty (see opponentDeck.js), instead of the same 8 goons
    // forever.
    const { cards: opponentCards, crewName } = buildOpponentDeck(aiDifficulty);
    const healthMod = OPPONENT_HEALTH_MOD_BY_DIFFICULTY[aiDifficulty] ?? 0;

    const initialOpponentDeck = shuffleDeck(opponentCards);

    // Set opponent health based on difficulty
    setOpponentHealth(30 + healthMod);
    setOpponentMaxHealth(30 + healthMod);

    const playerInitialHand = initialPlayerDeck.slice(0, 5);
    const playerRemainingDeck = initialPlayerDeck.slice(5);

    setPlayerHand(playerInitialHand);
    setPlayerDeck(playerRemainingDeck);

    // Chuck's opener is summoning-sick too, so neither side swings on its
    // first turn. Without this the rule is lopsided: the player's turn-1 play
    // has to sit still while the opener — placed before the game even starts —
    // hits it for free, handing Chuck first blood every single game.
    setOpponentField([{ ...withHp(initialOpponentDeck[0]), summoningSick: true }]);
    setOpponentDeck(initialOpponentDeck.slice(1));

    addToBattleLog(`${OPPONENT_NAME} slams his deck on the table with ${crewName} at his back. Difficulty: ${aiDifficulty.toUpperCase()}`);
    addToBattleLog("Your turn. Make it hurt.");
    setDeckReady(true);
    speak('gameStart');
  }, [addToBattleLog, currentDeck, aiDifficulty, gameId, speak]);

  // Check for game over. Opponent death is checked first so that a simultaneous
  // lethal (both reach 0 in the same commit) counts as a win for the player who
  // dealt it, rather than an unconditional loss.
  useEffect(() => {
    if (gameOver) return;
    if (opponentHealth <= 0) {
      clearAllTimeouts(); // cancel any queued opponent-turn steps
      setGameOver(true);
      setWinner('player');
      setOppQuip(null);
      setPlayerQuip(null); // its dismiss timer was just cancelled by clearAllTimeouts
      setEndQuip(pickQuip('oppLoses'));
      playSound('victory');

      // Record victory — store handles XP and coin rewards
      const { xpGain, coinsGain } = recordBattleResult(
        true,
        battleStatsRef.current.damageDealt,
        battleStatsRef.current.healingDone,
        playerHealth,
        battleStatsRef.current.cardsPlayed,
        battleStatsRef.current.damageTaken
      );
      setBattleRewards({ xp: xpGain, coins: coinsGain });

      // Sync to server (fire and forget - don't block UI)
      syncBattleResult(true, battleStatsRef.current.damageDealt, battleStatsRef.current.healingDone, coinsGain, useGameStore.getState().ownerUserId)
        .catch(err => console.error('Battle sync failed:', err));
      // recordBattleResult ran addXP synchronously, so the store level/xp are
      // now current. Push them so the leaderboard's rival rows stop reading as
      // Level 1 (players.experience is otherwise never written).
      syncLevelToServer();

      // Victory confetti
      celebrate({
        particleCount: 150,
        spread: 100,
        origin: { y: 0.6 },
        colors: ['#fbbf24', '#f59e0b', '#fde68a', '#a855f7', '#38bdf8'],
      });
      // No result toast, here or on a defeat: the game-over dialog announces
      // the result (it is labelled Victory / Defeat), and a toast only landed
      // on top of it saying the same thing.
    } else if (playerHealth <= 0) {
      clearAllTimeouts(); // cancel any queued opponent-turn steps
      setGameOver(true);
      setWinner('opponent');
      setOppQuip(null);
      setPlayerQuip(null); // its dismiss timer was just cancelled by clearAllTimeouts
      setEndQuip(pickQuip('oppWins'));
      playSound('defeat');

      // Record defeat — store now handles consolation coins internally
      const { xpGain, coinsGain } = recordBattleResult(
        false,
        battleStatsRef.current.damageDealt,
        battleStatsRef.current.healingDone,
        playerHealth,
        battleStatsRef.current.cardsPlayed
      );
      setBattleRewards({ xp: xpGain, coins: coinsGain });

      // Sync to server (fire and forget - don't block UI)
      syncBattleResult(false, battleStatsRef.current.damageDealt, battleStatsRef.current.healingDone, coinsGain, useGameStore.getState().ownerUserId)
        .catch(err => console.error('Battle sync failed:', err));
      // Keep the server level/xp current even on a loss (a loss still grants XP).
      syncLevelToServer();
    }
  }, [playerHealth, opponentHealth, gameOver, playSound, recordBattleResult, aiDifficulty, clearAllTimeouts]);

  // Chuck starts sweating when he's nearly unstuffed — once per game.
  useEffect(() => {
    if (gameOver) return;
    if (opponentHealth > 0 && opponentHealth <= 8 && !nearDeathQuippedRef.current) {
      nearDeathQuippedRef.current = true;
      speak('oppNearDeath');
    }
  }, [opponentHealth, gameOver, speak]);

  // Handle draw phase. The draw mutates playerDeck/playerHand — this effect's
  // own dependencies — so without a per-turn guard it re-fires during the
  // 500ms draw window and keeps drawing until the phase flips (draining the
  // deck; and StrictMode's double-invoke would add the same card twice,
  // producing duplicate hand keys). The ref guarantees exactly one draw per
  // turn per game.
  const lastDrawRef = useRef(null);
  useEffect(() => {
    if (!deckReady || currentTurn !== 'player' || gameOver || phase !== 'draw') return;

    const drawKey = `${gameId}-${turnCount}`;
    if (lastDrawRef.current === drawKey) return;
    lastDrawRef.current = drawKey;

    if (playerDeck.length === 0) {
      addToBattleLog("Deck is empty!");
    } else if (playerHand.length >= MAX_HAND_SIZE) {
      addToBattleLog(`Hand is full (${MAX_HAND_SIZE}) — skipped draw`);
    } else {
      const drawnCard = playerDeck[0];
      setPlayerHand(prev => [...prev, drawnCard]);
      setPlayerDeck(prev => prev.slice(1));
      playSound('draw');
      // No toast: the card arriving in the hand is the news, and the log
      // records it. A toast every turn was noise on the table's centre line.
      addToBattleLog(`Drew ${drawnCard.name}`);
    }
    // Remove stealth from cards that have been on field for a turn
    setPlayerField(prev => prev.map(c => ({ ...c, stealthActive: false })));
    safeTimeout(() => setPhase('main'), 500);
  }, [deckReady, phase, currentTurn, turnCount, gameId, playerDeck, playerHand.length, gameOver, addToBattleLog, playSound, safeTimeout]);

  // Get valid attack targets considering abilities. Traps are excluded: they
  // are not creatures and spring on their own, so they must never gate a direct
  // attack — otherwise a board of only traps soft-locks the game.
  // getValidTargets now lives in battleUtils (pure, and unit-tested for the
  // taunt > protect > all precedence — see battleUtils.test.js). Imported at
  // the top; both call sites here pass (attackerField, defenderField) as before.

  // Play a card from hand
  const playCard = (card) => {
    if (currentTurn !== 'player' || phase !== 'main') return;

    // A 'swarm' card is 1 energy cheaper (min 1) once another creature is
    // already on the field — see effectiveCost. Use this for both the
    // affordability check and the deduction below so the rule and the UI
    // (and the "not enough energy" message) always agree.
    const cost = effectiveCost(card, playerField);

    if (playerEnergy < cost) {
      toast({
        title: "Not enough energy!",
        description: `${card.name} costs ${cost} energy`,
        variant: "destructive",
      });
      return;
    }

    // Handle special cards
    if (card.type === 'special') {
      applySpecialEffect(card);
      setPlayerEnergy(prev => prev - cost);
      setPlayerHand(prev => prev.filter(c => c.instanceId !== card.instanceId));
      setPlayerMomentum(prev => Math.min(10, prev + 1));
      battleStatsRef.current.cardsPlayed += 1;
      playSound('cardPlay');
      return;
    }

    // Handle action/trap cards
    if (playerField.length >= 3) {
      toast({
        title: "Field is full!",
        description: "Remove a teddy before playing another",
        variant: "destructive",
      });
      return;
    }

    // Stamp starting HP; apply stealth on play. Creatures also enter
    // summoning-sick, so they cannot swing until the player's next turn (see
    // canAttack in battleUtils) — traps never attack, so they carry no flag.
    const cardToPlay = {
      ...withHp(card),
      ...(card.type === 'action' ? { summoningSick: true } : {}),
      ...(card.ability === 'stealth' ? { stealthActive: true } : {}),
    };

    setPlayerField(prev => [...prev, cardToPlay]);
    setPlayerHand(prev => prev.filter(c => c.instanceId !== card.instanceId));
    setPlayerEnergy(prev => prev - cost);
    setPlayerMomentum(prev => Math.min(10, prev + 1));
    battleStatsRef.current.cardsPlayed += 1;
    playSound('cardPlay');

    // One callout per play. A card with a rule gets the ability callout, which
    // names the card as well; a plain card gets the toast. Both used to fire
    // together and stack on the table's centre line, and the callout still
    // clears a toast left over from earlier in the turn (a draw) for the same
    // reason. The log entry below is what a screen reader hears either way.
    if (card.ability && card.ability !== 'none') {
      dismissToasts();
      setShowAbilityPopup({ name: card.name, ability: card.ability });
      safeTimeout(() => setShowAbilityPopup(null), 1500);
    } else {
      toast({ title: "Card Played", description: `${card.name} enters the battlefield!` });
    }

    addToBattleLog(`Played ${card.name}${card.ability && card.ability !== 'none' ? ` (${card.ability})` : ''}`);
  };

  // Apply special card effects
  const applySpecialEffect = (card) => {
    switch (card.effect) {
      case 'heal': {
        // Credit the healing that actually landed, not the card's face value.
        // Healing caps at 30, so playing a +10 heal at 28 HP restores 2 — but
        // the full 10 was being counted toward the 'Medic Bear' achievement and
        // the daily healing challenge, letting both be farmed at full HP.
        const healed = Math.min(30, playerHealth + card.amount) - playerHealth;
        setPlayerHealth(prev => Math.min(30, prev + card.amount));
        battleStatsRef.current.healingDone += healed;
        if (healed > 0) pushFx([{ face: 'player', tone: 'heal', text: `+${healed}` }]);
        playSound('heal');
        addToBattleLog(`${card.name}: +${healed} HP. No questions asked.`);
        toast({ title: "Patched Up!", description: `+${healed} HP. The stuffing guy owed you a favor.` });
        break;
      }
      case 'draw': {
        // The card being played is still in playerHand here — playCard calls
        // applySpecialEffect BEFORE filtering it out — so the hand cap has to
        // account for the slot it is about to free. Without the -1 a 9-card
        // hand playing "draw 2" only drew 1 and finished at 9 instead of 10.
        const handAfterPlay = Math.max(0, playerHand.length - 1);
        const cardsToDraw = Math.min(card.amount, playerDeck.length, Math.max(0, MAX_HAND_SIZE - handAfterPlay));
        const drawnCards = playerDeck.slice(0, cardsToDraw);
        setPlayerHand(prev => [...prev, ...drawnCards]);
        setPlayerDeck(prev => prev.slice(cardsToDraw));
        playSound('draw');
        addToBattleLog(`${card.name}: drew ${cardsToDraw} — the dealer likes you`);
        toast({ title: "Hit Me!", description: `Drew ${cardsToDraw}. The house always wins — congrats, you are the house.` });
        break;
      }
      case 'buff':
        pushFx(playerField.map((c) => ({ card: c.instanceId, tone: 'buff', text: `+${card.amount}` })));
        setPlayerField(prev => prev.map(c => ({ ...c, attack: c.attack + card.amount })));
        addToBattleLog(`Your whole squad is FIRED UP — +${card.amount} attack across the board!`);
        toast({ title: 'Juiced!', description: `Everybody +${card.amount} attack. Totally natural. Don't test them.` });
        break;
      default:
        break;
    }
  };

  // Select a card for attacking
  const selectCardForAttack = (card) => {
    if (currentTurn !== 'player' || phase !== 'battle') return;
    if (card.type === 'trap') {
      toast({ title: "Traps can't attack", description: `${card.name} springs automatically when an enemy strikes it.`, variant: "destructive" });
      return;
    }
    if (card.summoningSick) {
      toast({
        title: "Still finding the floor",
        description: `${card.name} only just staggered in — it can swing from your next turn.`,
        variant: "destructive",
      });
      return;
    }
    if (card.hasAttacked) {
      toast({ title: "Already attacked", description: `${card.name} has already attacked this turn`, variant: "destructive" });
      return;
    }

    // Selection always proceeds; the attack step enforces taunt/protect and
    // allows a direct hit when only traps or stealthed cards remain.
    setSelectedCard(card);
    setTargetingMode(true);
    // On narrow screens a toast sits on the centre line, exactly where the
    // "Pick a victim" prompt appears.
    dismissToasts();
  };

  // Attack a target
  const attackTarget = (target) => {
    if (!selectedCard || !targetingMode) return;

    // Only creatures are valid targets (traps spring on their own and are
    // triggered by going face — see attackOpponentDirectly).
    const validTargets = getValidTargets(playerField, opponentField);
    if (!validTargets.find(t => t.instanceId === target.instanceId)) {
      // Say WHY, for every reason a target can be blocked. This branch used to
      // cover only taunt and, worse, could not run at all: the click handler
      // was gated on isValidTarget, so tapping a blocked teddy did nothing
      // whatsoever and the message below was dead code. The rule the player
      // has just run into is the most interesting thing on the board — it is
      // the whole point of taunt and protect — so it has to be spoken aloud.
      // Mirrors getValidTargets' own precedence: traps and stealth first,
      // then taunt, then protect.
      const blocked = describeBlockedTarget(target, opponentField);
      if (blocked) toast({ ...blocked, variant: "destructive" });
      return;
    }

    // Re-read the attacker from the live field instead of trusting the
    // selection snapshot. selectedCard is captured when targeting opens, but
    // the board can change while targeting is still up — Rally is the reachable
    // case: it replaces every field card with a +1-attack, fully-restuffed copy,
    // so attacking after rallying mid-targeting resolved with the stale
    // pre-Rally attack and silently ate the buff the player just spent a full
    // momentum gauge on.
    const attacker = playerField.find(c => c.instanceId === selectedCard.instanceId) || selectedCard;

    // Resolve against the target's HP: it survives a non-lethal hit (and its
    // fury fires), or dies and trample overkill spills to the opponent's face.
    // Pass playerField so a 'royal' ally on the attacker's side buffs the hit.
    const { survivor, overkill, dmg } = resolveCreatureHit(attacker, target, playerField);
    playSound('attack');
    battleStatsRef.current.damageDealt += dmg;
    pushFx([
      { card: attacker.instanceId, strike: 'up' },
      { card: target.instanceId, hit: true, tone: 'damage', text: `−${dmg}` },
      ...(!survivor && overkill > 0 ? [{ face: 'opponent', tone: 'damage', text: `−${overkill}` }] : []),
    ]);

    if (survivor) {
      setOpponentField(prev => prev.map(c => c.instanceId === target.instanceId ? survivor : c));
      if (target.ability === 'fury') {
        addToBattleLog(gainedFuryStack(target, survivor)
          ? `${target.name}'s fury activated! +1 attack`
          : `${target.name} is already as furious as they get — capped at +3.`);
      }
      addToBattleLog(`${attacker.name} smacked ${target.name} for ${dmg} (${survivor.currentHp} HP left)`);
      toast({ title: "Hit!", description: `${target.name} is hanging on at ${survivor.currentHp} HP.` });
    } else {
      setOpponentField(prev => prev.filter(c => c.instanceId !== target.instanceId));
      if (overkill > 0) setOpponentHealth(prev => Math.max(0, prev - overkill));
      addToBattleLog(`UNSTUFFED! ${attacker.name} took ${target.name} apart${overkill > 0 ? ` — ${overkill} trampled right into ${OPPONENT_NAME}'s beans` : ''}`);
      toast({ title: "UNSTUFFED!", description: `${target.name} is fluff on the floor${overkill > 0 ? ` — ${overkill} tramples through!` : '.'}` });
      speak('oppLosesCreature');
    }

    // Mark card as having attacked
    setPlayerField(prev => prev.map(c =>
      c.instanceId === selectedCard.instanceId ? { ...c, hasAttacked: true } : c
    ));

    setPlayerMomentum(prev => Math.min(10, prev + 2));
    setSelectedCard(null);
    setTargetingMode(false);
  };

  // Attack opponent directly
  const attackOpponentDirectly = () => {
    if (!selectedCard || !targetingMode) return;

    const validTargets = getValidTargets(playerField, opponentField);
    if (validTargets.length > 0) {
      toast({
        title: "Blocked!",
        description: `${OPPONENT_NAME}'s goons are in the way. Deal with them first.`,
        variant: "destructive"
      });
      return;
    }

    // No blocking creatures. If the opponent has a trap on the field, the attack
    // springs it (the attacker takes the trap damage and the trap is consumed)
    // instead of hitting face — so traps stay meaningful without permanently
    // gating the attack: the next strike gets through.
    const trap = opponentField.find(c => c.type === 'trap');
    if (trap) {
      const trapDamage = trap.amount || 3;
      pushFx([
        { card: selectedCard.instanceId, strike: 'up' },
        { face: 'player', tone: 'damage', text: `−${trapDamage}` },
      ]);
      setPlayerHealth(prev => Math.max(0, prev - trapDamage));
      battleStatsRef.current.damageTaken += trapDamage;
      setOpponentField(prev => prev.filter(c => c.instanceId !== trap.instanceId));
      playSound('trap');
      addToBattleLog(`${trap.name} sprang! ${trapDamage} damage, right in your pride`);
      toast({ title: "It's a Trap!", description: `${trap.name} got you for ${trapDamage}. ${OPPONENT_NAME} is giggling.`, variant: "destructive" });
    } else {
      // Re-read the attacker from the live field, not the selection snapshot:
      // Rally mid-targeting replaces every field card with a +1-attack copy, so
      // computing from selectedCard would deal the pre-Rally value straight to
      // face — the same stale-snapshot bug already fixed in attackTarget.
      // effectiveAttack then folds in any 'royal' ally aura on top.
      const attacker = playerField.find(c => c.instanceId === selectedCard.instanceId) || selectedCard;
      const faceDamage = effectiveAttack(attacker, playerField);
      playSound('attack');
      pushFx([
        { card: attacker.instanceId, strike: 'up' },
        { face: 'opponent', tone: 'damage', text: `−${faceDamage}` },
      ]);
      setOpponentHealth(prev => Math.max(0, prev - faceDamage));
      battleStatsRef.current.damageDealt += faceDamage;
      addToBattleLog(`${attacker.name} decked ${OPPONENT_NAME} in the face for ${faceDamage}!`);
      toast({ title: "Right in the Face!", description: `${faceDamage} damage straight to ${OPPONENT_NAME}'s smug mug.` });
      if (faceDamage >= 4) speak('oppTakesFaceHit');
    }

    setPlayerField(prev => prev.map(c =>
      c.instanceId === selectedCard.instanceId ? { ...c, hasAttacked: true } : c
    ));

    setPlayerMomentum(prev => Math.min(10, prev + 3));
    setSelectedCard(null);
    setTargetingMode(false);
  };

  // Move to battle phase
  const goToBattlePhase = () => {
    if (phase !== 'main') return;
    setPhase('battle');
    addToBattleLog("Battle phase. Gloves off, paws up.");
  };

  // End turn
  const endTurn = () => {
    // Guard like every sibling handler: only the player, on their own turn, ends
    // it — so a stray call during the opponent's turn can't queue a second
    // executeOpponentTurn.
    if (currentTurn !== 'player') return;
    setPlayerField(prev => readyCreatures(prev));
    setSelectedCard(null);
    setTargetingMode(false);
    setCurrentTurn('opponent');
    setPhase('end');
    addToBattleLog("Ending turn...");
    safeTimeout(executeOpponentTurn, 1000);
  };

  // Momentum payoff: at a full gauge, spend it all to rally the board — every
  // teddy gets +1 attack and heals to full HP (the only way to heal wounded
  // creatures under the HP model). Usable any time on the player's turn.
  const rally = () => {
    if (currentTurn !== 'player' || gameOver || playerMomentum < MOMENTUM_MAX) return;
    pushFx(playerField.map((c) => ({ card: c.instanceId, tone: 'buff', text: '+1' })));
    setPlayerField(prev => rallyField(prev));
    setPlayerMomentum(0);
    playSound('heal');
    celebrate({
      particleCount: 120, spread: 90, origin: { y: 0.7 },
      colors: ['#fbbf24', '#f59e0b', '#f97316', '#fde68a'],
    });
    addToBattleLog('⚡ RALLY! Your teddies scream something unprintable — +1 attack, fully restuffed!');
    toast({ title: '⚡ Rally!', description: 'Your squad is juiced, restuffed, and legally a mob now.' });
    speak('playerRally');
  };

  // Opponent AI turn
  const executeOpponentTurn = () => {
    addToBattleLog(`${OPPONENT_NAME}'s turn. Brace your beans.`);

    // Remove stealth from opponent cards. Compute the cleared field once and
    // use it for BOTH the state update and the attack loop below — the loop
    // otherwise iterates this closure's stale snapshot, where a stealth card
    // played last turn still reads stealthActive and skips an extra full turn
    // of attacks.
    const activeOpponentField = opponentField.map(c => ({ ...c, stealthActive: false }));
    setOpponentField(prev => prev.map(c => ({ ...c, stealthActive: false })));

    // Opponent plays every card it can afford within its per-turn energy
    // budget (difficulty-scaled) while the field has room. Only played cards
    // leave the deck, so a full board never mills it.
    const energyBudget = OPPONENT_ENERGY_BY_DIFFICULTY[aiDifficulty] ?? OPPONENT_ENERGY_BY_DIFFICULTY.normal;
    // Pass activeOpponentField so a 'swarm' card in the opponent's hand is
    // budgeted at its discounted cost under the same rule the player follows.
    const { plays, remainingDeck } = chooseOpponentPlays(opponentDeck, opponentField.length, energyBudget, 3, activeOpponentField);
    // Creatures the opponent plays THIS turn. They can't attack (summoning-sick),
    // but a 'royal' among them must still project its aura to the opponent's
    // other attackers this turn — mirroring the player, whose just-played royal
    // buffs immediately. The attack loop reads this for aura only.
    let playedThisTurn = [];
    if (plays.length > 0) {
      setOpponentDeck(remainingDeck);
      const played = plays.map(c => ({
        ...withHp(c),
        summoningSick: true,
        ...(c.ability === 'stealth' ? { stealthActive: true } : {}),
      }));
      playedThisTurn = played;
      setOpponentField(prev => [...prev, ...played]);
      playSound('cardPlay');
      plays.forEach(c => addToBattleLog(`${OPPONENT_NAME} slammed down ${c.name}`));
      speak('oppPlays');
    }

    // Opponent attacks — resolve against a live working copy so each attacker
    // re-evaluates targets (taunt/protect) as creatures fall, instead of every
    // attacker piling onto a single stale target and the rest no-opping.
    safeTimeout(() => {
      // Ready the working copy: endTurn already cleared these flags in state,
      // but this closure predates that render, and the unconditional write-back
      // below would otherwise restore them — bricking any attacker that
      // survives an opponent turn as permanently Exhausted, and any creature
      // played last turn as permanently summoning-sick.
      let livePlayerField = readyCreatures(playerField);
      let faceDamage = 0;
      let trapDamageToOpponent = 0;
      let killedPlayerCreature = false;
      const logs = [];
      // The wave's combat feedback, fired together once it has resolved —
      // before the write-back below, while every card it names (the dead
      // included) is still on screen to be measured.
      const waveFx = [];

      // Aura field for royal: the pre-existing board PLUS what was just played,
      // so a royal the opponent dropped this turn buffs its other attackers.
      // Attackers still come only from activeOpponentField (played cards are
      // summoning-sick and filtered by canAttack).
      const auraField = [...activeOpponentField, ...playedThisTurn];

      activeOpponentField.forEach(card => {
        if (!canAttack(card)) return; // summoning-sick, spent, or not a creature

        // Creature blockers (taunt/protect/normal) must be dealt with first.
        const targets = getValidTargets(opponentField, livePlayerField);

        if (targets.length > 0) {
          // Attack the biggest threat; resolve against its HP just like the
          // player's attackTarget — it survives (fury fires) or dies with trample
          // overkill carrying through to the player's face.
          const target = chooseAttackTarget(targets, card);
          // Pass auraField so a 'royal' ally on the opponent's own field —
          // including one it just played this turn — buffs this attacker's hit,
          // same as the player's attackTarget.
          const { survivor, overkill, dmg } = resolveCreatureHit(card, target, auraField);
          playSound('attack');
          waveFx.push(
            { card: card.instanceId, strike: 'down' },
            { card: target.instanceId, hit: true, tone: 'damage', text: `−${dmg}` },
          );
          if (!survivor && overkill > 0) waveFx.push({ face: 'player', tone: 'damage', text: `−${overkill}` });
          if (survivor) {
            livePlayerField = livePlayerField.map(c => c.instanceId === target.instanceId ? survivor : c);
            if (target.ability === 'fury') {
              logs.push(gainedFuryStack(target, survivor)
                ? `${target.name} is FURIOUS now! +1 attack`
                : `${target.name} is capped out at +3 fury — poke away.`);
            }
            logs.push(`${card.name} roughed up ${target.name} for ${dmg} (${survivor.currentHp} HP left)`);
          } else {
            livePlayerField = livePlayerField.filter(c => c.instanceId !== target.instanceId);
            faceDamage += overkill;
            killedPlayerCreature = true;
            logs.push(`${card.name} UNSTUFFED ${target.name}${overkill > 0 ? ` — ${overkill} trampled into your beans` : ''}`);
          }
          return;
        }

        // No creature blockers. A player trap springs on the attacker (and is
        // consumed); otherwise the attack hits face.
        const trap = livePlayerField.find(c => c.type === 'trap');
        if (trap) {
          const trapDamage = trap.amount || 3;
          trapDamageToOpponent += trapDamage;
          waveFx.push(
            { card: card.instanceId, strike: 'down' },
            { face: 'opponent', tone: 'damage', text: `−${trapDamage}` },
          );
          livePlayerField = livePlayerField.filter(c => c.instanceId !== trap.instanceId);
          playSound('trap');
          logs.push(`Your ${trap.name} sprang! ${OPPONENT_NAME} ate ${trapDamage} damage. Delicious.`);
        } else {
          // Include a 'royal' ally's aura in the opponent's face damage too, not
          // just its creature-vs-creature hits. Uses auraField so a royal played
          // this turn counts. Mirrors the player-side fix at attackOpponentDirectly.
          const oppFaceDamage = effectiveAttack(card, auraField);
          faceDamage += oppFaceDamage;
          playSound('attack');
          waveFx.push(
            { card: card.instanceId, strike: 'down' },
            { face: 'player', tone: 'damage', text: `−${oppFaceDamage}` },
          );
          logs.push(`${card.name} socked you right in the face for ${oppFaceDamage}!`);
        }
      });

      pushFx(waveFx);
      setPlayerField(livePlayerField);
      // Chuck's board has now sat through a full round, so everything on it —
      // the opener, and whatever he just slammed down — is settled and free to
      // swing next turn. Done after the wave rather than before it so cards
      // played this turn still sit out the turn they arrived.
      setOpponentField(prev => readyCreatures(prev));
      if (faceDamage > 0) {
        setPlayerHealth(prev => Math.max(0, prev - faceDamage));
        battleStatsRef.current.damageTaken += faceDamage;
      }
      if (trapDamageToOpponent > 0) {
        setOpponentHealth(prev => Math.max(0, prev - trapDamageToOpponent));
        battleStatsRef.current.damageDealt += trapDamageToOpponent;
      }
      logs.forEach(addToBattleLog);
      // One gloat per attack wave, best material first: a kill outranks a jab.
      if (killedPlayerCreature) speak('oppKills');
      else if (faceDamage > 0) speak('oppHitsFace');

      safeTimeout(() => {
        setCurrentTurn('player');
        setTurnCount(prev => prev + 1);
        // turnCount is still the pre-increment value in this closure — use +1
        // so energy tracks the turn the player is about to take.
        setPlayerEnergy(Math.min(10, 3 + Math.floor((turnCount + 1) / 2)));
        setPhase('draw');
        addToBattleLog("Your turn. Get him.");
      }, 500);
    }, 1000);
  };

  // Cancel targeting
  const cancelTargeting = () => {
    setSelectedCard(null);
    setTargetingMode(false);
  };

  // Concede the battle — counts as a loss. Guarantees the player can always
  // exit a stalled board (e.g. a hand of only buff/heal cards with an empty
  // deck) instead of being soft-locked with no damaging play available.
  const concedeGame = () => {
    if (gameOver) return;
    if (typeof window !== 'undefined' &&
        !window.confirm(`Concede this battle? It counts as a loss, and ${OPPONENT_NAME} will NEVER let you hear the end of it.`)) {
      return;
    }
    clearAllTimeouts(); // cancel any in-flight opponent-turn steps
    addToBattleLog(`You conceded. ${OPPONENT_NAME} is doing a little dance.`);
    setPlayerHealth(0); // routes through the existing defeat flow
  };

  // Restart game with proper state reset
  const restartGame = () => {
    // Cancel any queued opponent-turn steps from the finished game so they can't
    // fire and mutate the fresh board.
    clearAllTimeouts();

    // Reset battle stats ref
    battleStatsRef.current = { damageDealt: 0, healingDone: 0, cardsPlayed: 0, damageTaken: 0 };

    // Reset game state. deckReady gates the draw phase until the init effect
    // has dealt the new opening hand.
    setDeckReady(false);
    setPhase('draw');
    setCurrentTurn('player');
    setTurnCount(1);

    // Reset player state
    setPlayerHealth(30);
    setPlayerEnergy(3);
    setPlayerMomentum(0);
    setPlayerHand([]);
    setPlayerField([]);
    setPlayerDeck([]);

    // Reset opponent state (initializeGame re-applies the difficulty mod to
    // both of these when the fresh game deals).
    setOpponentHealth(30);
    setOpponentMaxHealth(30);
    setOpponentField([]);
    setOpponentDeck([]);

    // Reset UI state
    setSelectedCard(null);
    setTargetingMode(false);
    setBattleLog([]);
    setFx([]);
    setGameOver(false);
    setWinner(null);
    setShowAbilityPopup(null);
    setBattleRewards({ xp: 0, coins: 0 });

    // Reset both mouths
    setOppQuip(null);
    setPlayerQuip(null);
    setEndQuip(null);
    lastQuipRef.current = null;
    nearDeathQuippedRef.current = false;

    // Re-arm abandonment tracking: after a bfcache-settled defeat, Play Again
    // keeps this component mounted, so the latch must reset or the NEW
    // battle's abandonment would silently never record.
    abandonHandledRef.current = false;
    abandonRewardsRef.current = null;

    // Increment gameId to trigger deck re-initialization useEffect
    setGameId(prev => prev + 1);
  };

  // Get ability description
  const getAbilityDescription = (ability) => {
    const descriptions = {
      taunt: "Forces enemies to attack this card first",
      piercing: "Cuts through Shield (defense here is HP, and piercing does not skip it)",
      shield: "Takes 50% less damage",
      stealth: "Can't be targeted for one turn",
      protect: "Other cards can't be targeted",
      fury: "Gains +1 attack when damaged (up to +3)",
      swarm: "Costs 1 less energy (min 1) if you already control another creature",
      royal: "Other creatures you control get +1 attack while this is on the field",
    };
    return descriptions[ability] || "";
  };

  const won = winner === 'player';
  const playerTurn = currentTurn === 'player';
  const directTargets = targetingMode && getValidTargets(playerField, opponentField).length === 0;
  const latestLog = battleLog.length > 0 ? battleLog[battleLog.length - 1].message : '';
  // What the combat feedback says about one card right now.
  const fxFor = (id) => {
    let hit = null;
    let strike = null;
    for (const e of fx) {
      if (e.card !== id) continue;
      if (e.hit) hit = e;
      if (e.strike) strike = e.strike;
    }
    return { hit, strike };
  };
  const faceFx = (side) => fx.filter((e) => e.face === side);
  const lastPlayerHit = [...fx].reverse().find((e) => e.face === 'player' && e.tone === 'damage');

  // Fit the two card rows to the table. The board is a fixed-height column
  // (rails, table, controls, hand), and the height the table actually gets
  // depends on the real viewport — a phone's browser toolbars, the control row
  // wrapping, a short window — which fixed viewport-height breakpoints could
  // not see: on short phones the player's row spilled out of the felt onto
  // the turn controls and took their taps. So measure the felt and scale the
  // rows to what fits (CSS zoom, so the layout scales with them), on resize
  // only. Rows reserve a status chip's height whether or not one is showing,
  // so a "Warming Up" appearing never rescales the board.
  const [fieldZoom, setFieldZoom] = useState(1);
  const rowSlots = Math.max(1, playerField.length, opponentField.length + (directTargets ? 1 : 0));
  const rowSlotsRef = useRef(rowSlots);
  rowSlotsRef.current = rowSlots;
  const fitField = useCallback(() => {
    const felt = feltRef.current;
    const centre = centreRef.current;
    if (!felt || !centre) return;
    const cs = getComputedStyle(felt);
    const px = (v) => parseFloat(v) || 0;
    const forRows = felt.clientHeight - px(cs.paddingTop) - px(cs.paddingBottom)
      - centre.offsetHeight - 2 * px(cs.rowGap);
    const width = felt.clientWidth - px(cs.paddingLeft) - px(cs.paddingRight);
    const n = rowSlotsRef.current;
    const fit = Math.min(1, forRows / (2 * FIELD_ROW_HEIGHT), width / (n * FIELD_SLOT + (n - 1) * FIELD_GAP));
    setFieldZoom(Math.max(0.45, Math.floor(fit * 100) / 100));
    // Where the centre line really is, for the narrow-screen toast placement
    // in index.css (toasts are fixed, so viewport coordinates are right).
    const r = centre.getBoundingClientRect();
    document.documentElement.style.setProperty('--battle-centre-y', `${Math.round(r.top + r.height / 2)}px`);
  }, []);
  useEffect(() => {
    if (typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(() => fitField());
    if (feltRef.current) observer.observe(feltRef.current);
    if (centreRef.current) observer.observe(centreRef.current);
    return () => {
      observer.disconnect();
      document.documentElement.style.removeProperty('--battle-centre-y');
    };
  }, [fitField]);
  useEffect(() => { fitField(); }, [rowSlots, fitField]);

  return (
    // Exactly the viewport's height on touch screens. With a mouse it never
    // goes below 640px and the page scrolls instead: zooming the browser in
    // shrinks the CSS viewport, and a board fitted to it would answer by
    // making the cards smaller — the opposite of what zooming in asked for.
    // (The height must stay definite either way; the felt's fit is measured
    // from it.)
    <div className="relative w-full h-[100dvh] [@media(pointer:fine)]:h-[max(100dvh,40rem)] bar-backdrop overflow-hidden">
      <div className="absolute inset-0 grain pointer-events-none" aria-hidden="true" />
      {/* A hit to your face reddens the edges of the screen for a moment. */}
      {lastPlayerHit && <div key={lastPlayerHit.id} className="fx-vignette" aria-hidden="true" />}

      {/* Landscape phones: the board needs more height than a sideways phone
          has (two card rows, a hand and two rails in ~360px), and below that
          it overlaps itself — Chuck's cards across the turn controls. CSS
          decides when this shows (index.css, .rotate-hint). The board stays in
          the accessibility tree underneath, so assistive tech can still play. */}
      <div className="rotate-hint" aria-hidden="true">
        <Smartphone className="h-10 w-10 text-brass-300" strokeWidth={1.75} />
        <p className="font-display text-xl font-extrabold text-white">Turn your phone upright</p>
        <p className="text-sm text-plush-200 max-w-xs">The table needs more height than a sideways phone has.</p>
      </div>

      {/* Game Over Overlay */}
      <AnimatePresence>
        {gameOver && (
          <GameOverDialog
            label={won ? 'Victory' : 'Defeat'}
            onEscape={() => onBackToMenu && onBackToMenu()}
          >
            <motion.div
              initial={{ scale: 0.85, y: 30 }}
              animate={{ scale: 1, y: 0 }}
              className={`relative my-auto rounded-2xl px-6 py-7 sm:px-8 text-center max-w-md w-full overflow-hidden dialog-panel ${won ? 'trim-brass' : ''}`}
            >
              {/* The light the medallion sits in: amber for a win, a cold
                  wash for a loss. */}
              <div
                aria-hidden="true"
                className={`absolute inset-x-0 top-0 h-48 pointer-events-none ${won
                  ? 'bg-[radial-gradient(ellipse_60%_80%_at_50%_0%,rgba(251,191,36,0.28),transparent_70%)]'
                  : 'bg-[radial-gradient(ellipse_60%_80%_at_50%_0%,rgba(129,140,248,0.16),transparent_70%)]'}`}
              />
              <motion.div
                animate={{ scale: [1, 1.15, 1], rotate: [0, 8, -8, 0] }}
                transition={{ duration: 0.6 }}
                className="relative mx-auto mb-4 h-20 w-20 rounded-full p-[3px]"
                style={{ background: won ? RARITY_METAL.legendary : RARITY_METAL.common }}
                aria-hidden="true"
              >
                <div className="flex h-full w-full items-center justify-center rounded-full bg-night-900">
                  {won
                    ? <Trophy className="h-9 w-9 text-brass-300" strokeWidth={1.75} />
                    : <HeartCrack className="h-9 w-9 text-plush-300" strokeWidth={1.75} />}
                </div>
              </motion.div>
              <h2 className={`relative font-display text-3xl sm:text-4xl font-extrabold leading-tight mb-2 ${won ? 'text-brass-gradient' : 'text-plush-100'}`}>
                {won ? 'TOTAL FLUFFING VICTORY!' : 'ABSOLUTELY UNSTUFFED!'}
              </h2>
              <p className="relative mb-2 text-plush-200">
                {won
                  ? `${OPPONENT_NAME} rage-quit into the toy chest.`
                  : `${OPPONENT_NAME} is doing a victory lap. It's insufferable.`}
              </p>
              {endQuip && (
                <p className="relative mb-5 text-sm italic text-plush-300">
                  🧸 {OPPONENT_NAME}: “{endQuip}”
                </p>
              )}

              {/* Rewards */}
              <div className="relative mb-5">
                <div className="label-caps text-plush-300 mb-2">Battle Rewards</div>
                <div className="flex justify-center gap-3">
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: 0.3 }}
                    className="panel-glass rounded-xl px-4 py-2.5 flex items-center gap-2"
                  >
                    <Star className="h-5 w-5 text-brass-300" fill="currentColor" aria-hidden="true" />
                    <span className="font-display text-lg font-extrabold text-white tabular-nums">
                      +{battleRewards.xp} XP
                    </span>
                  </motion.div>
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: 0.5 }}
                    className="panel-glass rounded-xl px-4 py-2.5 flex items-center gap-2"
                  >
                    <Coins className="h-5 w-5 text-brass-300" aria-hidden="true" />
                    <span className="font-display text-lg font-extrabold text-white tabular-nums">
                      +{battleRewards.coins}
                    </span>
                    <span className="sr-only">coins</span>
                  </motion.div>
                </div>
              </div>

              {/* Upsell nudge — only shown when player is low on resources */}
              {(cardPacks === 0 || gems < 50) && (onOpenShop || onBackToMenu) && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.8 }}
                  className="relative mb-5 rounded-xl bg-black/25 ring-1 ring-white/5 p-3"
                >
                  <p className="text-sm mb-2 text-plush-200">
                    {cardPacks === 0 ? '📦 Out of packs? Your squad isn’t going to recruit itself.' : '💎 Low on gems? Chuck says being broke is a personality flaw.'}
                  </p>
                  <button
                    type="button"
                    onClick={onOpenShop ?? onBackToMenu}
                    className="btn-glass rounded-lg px-3 h-8 text-xs font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass-300"
                  >
                    Visit Shop
                  </button>
                </motion.div>
              )}

              <div className="relative flex gap-3 justify-center">
                <button type="button" onClick={restartGame} className={`${ACTION} btn-brass min-w-[8rem]`}>
                  Play Again
                </button>
                {onBackToMenu && (
                  <button type="button" onClick={onBackToMenu} className={`${ACTION} btn-glass min-w-[6rem]`}>
                    Menu
                  </button>
                )}
              </div>
            </motion.div>
          </GameOverDialog>
        )}
      </AnimatePresence>

      <div className="relative z-10 flex h-full flex-col">
        {/* Opponent's rail. pl-28 leaves room for App's "← Menu" control; the
            safe-area padding keeps it out from under a notch when the game is
            installed full-screen (the viewport is viewport-fit=cover). */}
        <div className="hud-opponent shrink-0 h-[calc(3.5rem+env(safe-area-inset-top))] sm:h-[calc(4rem+env(safe-area-inset-top))] pt-[env(safe-area-inset-top)] flex items-center justify-between gap-2 pl-28 pr-3 sm:pr-5">
          <div className="flex items-center gap-2.5 min-w-0">
            <Avatar ring={OPPONENT_RING} />
            <div className="min-w-0">
              <div className="font-display font-extrabold text-white leading-tight truncate max-w-[7rem] sm:max-w-none">{OPPONENT_NAME}</div>
              <div className="text-red-200/80 text-[11px] whitespace-nowrap">Deck: {opponentDeck.length}</div>
            </div>
            {/* Opponent's draw pile, face down on the table */}
            {opponentDeck.length > 0 && (
              <div className="relative w-8 h-11 shrink-0 hidden sm:block" aria-hidden="true">
                <div className="absolute inset-0 rotate-6"><CardBack className="w-8 h-11" mini /></div>
                <div className="absolute inset-0 -rotate-3"><CardBack className="w-8 h-11" mini /></div>
                <CardBack className="w-8 h-11" mini />
              </div>
            )}
          </div>
          <HealthMeter
            hp={opponentHealth}
            max={opponentMaxHealth}
            fx={faceFx('opponent')}
            drift="down"
            fill="[&>div]:bg-gradient-to-r [&>div]:from-red-600 [&>div]:to-rose-400"
            label={`${OPPONENT_NAME} health: ${opponentHealth} of ${opponentMaxHealth}`}
          />
        </div>

        {/* The table, and beside it from md up the log and the controls. */}
        <div className="relative flex-1 min-h-0 flex flex-col md:flex-row gap-2 md:gap-4 px-2 sm:px-4 lg:px-6 pt-2 sm:pt-3">
          <div className="table-rail flex-1 min-h-0 min-w-0">
            <div
              ref={feltRef}
              className="felt-table felt-print stitched relative h-full rounded-[15px] grid grid-cols-[minmax(0,1fr)] grid-rows-[minmax(0,1fr)_auto_minmax(0,1fr)] gap-3 px-2 py-3 sm:p-4"
            >
              {/* Chuck's trash talk — decorative speech bubble in the felt's
                  corner on his side; the battle log is the accessible record,
                  so this is hidden from assistive tech. */}
              <AnimatePresence>
                {oppQuip && (
                  <motion.div
                    key={oppQuip.id}
                    aria-hidden="true"
                    initial={{ opacity: 0, y: -8, scale: 0.9 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    transition={{ type: 'spring', stiffness: 350, damping: 22 }}
                    className="absolute top-2 left-2 sm:top-3 sm:left-3 z-20 max-w-[150px] sm:max-w-[220px] pointer-events-none"
                  >
                    <div className="relative bg-plush-100 text-night-900 text-xs sm:text-sm font-semibold rounded-2xl rounded-tl-sm px-3 py-2 shadow-[0_10px_24px_-8px_rgba(0,0,0,0.8)] ring-1 ring-red-300/70">
                      <span className="mr-1">🧸</span>
                      {oppQuip.text}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Chuck's half */}
              <div className="self-center flex justify-center items-start gap-2 sm:gap-3" style={{ zoom: fieldZoom }}>
                <AnimatePresence>
                {opponentField.map((card) => {
                  const validTargets = getValidTargets(playerField, opponentField);
                  const isValidTarget = validTargets.find(t => t.instanceId === card.instanceId);
                  const hittable = targetingMode && isValidTarget;
                  const cfx = fxFor(card.instanceId);

                  return (
                    <FieldSlot
                      key={card.instanceId}
                      initial={{ y: -40, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      exit={CRUMPLE_CHUCK}
                      className={`relative ${hittable ? 'cursor-crosshair' : ''}`}
                      press={pressable(() => attackTarget(card), `Attack ${card.name}`, targetingMode)}
                    >
                      <div
                        ref={cardRef(card.instanceId)}
                        className={`relative rounded-[10px] transition-shadow ${hittable ? 'ring-2 ring-red-400 shadow-[0_0_22px_4px_rgba(248,113,113,0.55)]' : ''} ${cfx.hit ? 'fx-hit' : ''} ${cfx.strike === 'down' ? 'fx-strike-down' : ''}`}
                      >
                        {cfx.hit && <span key={cfx.hit.id} className="fx-flash" aria-hidden="true" />}
                        {/* Only the card dims for stealth; the band and tags
                            stay at full strength so they keep their contrast. */}
                        <div className={card.stealthActive ? 'opacity-50' : ''}>
                          <TeddyCard teddy={card} lift={false} />
                        </div>
                        {card.stealthActive && <StealthBand />}
                        {card.ability === 'taunt' && !card.stealthActive && <TauntTag tone="opponent" />}
                        {hittable && (
                          <span className="absolute -top-2.5 -right-2.5 z-20 grid h-7 w-7 place-items-center rounded-full bg-red-600 ring-2 ring-red-200 shadow-lg" aria-hidden="true">
                            <Crosshair className="h-4 w-4 text-white" />
                          </span>
                        )}
                      </div>
                      {/* Tells the player which of Chuck's teddies can actually swing
                          at them next turn — without it, summoning sickness is only
                          legible on their own half of the table. */}
                      <StatusSlot>{card.summoningSick && <StatusChip>Warming Up</StatusChip>}</StatusSlot>
                    </FieldSlot>
                  );
                })}
                </AnimatePresence>
                {directTargets && (
                  <motion.div
                    whileHover={{ scale: 1.04 }}
                    className="w-24 h-36 rounded-[10px] border-2 border-dashed border-red-400/80 bg-red-950/50 shadow-[0_0_22px_rgba(248,113,113,0.35)] flex flex-col items-center justify-center gap-2 cursor-crosshair"
                    {...pressable(attackOpponentDirectly, opponentField.some(c => c.type === 'trap') ? 'Strike (springs trap)' : 'Attack opponent directly')}
                  >
                    <Crosshair className="h-7 w-7 text-red-300" aria-hidden="true" />
                    <span className="text-red-200 text-xs font-bold text-center px-1">
                      {opponentField.some(c => c.type === 'trap') ? 'Strike (springs trap)' : 'Attack Directly'}
                    </span>
                  </motion.div>
                )}
              </div>

              {/* The centre line: momentum, the turn plaque, and a second line
                  that is always reserved — the targeting prompt, or below md
                  the latest event — so neither appearing moves the rows. */}
              <div ref={centreRef} className="relative flex flex-col items-center gap-1.5">
                <div className="flex w-full items-center gap-2 sm:gap-3">
                  <MomentumMeter value={playerMomentum} glow={!gameOver} />
                  <span className="h-px flex-1 bg-gradient-to-r from-transparent to-brass-300/45" aria-hidden="true" />
                  <div
                    className={`shrink-0 rounded-lg px-3 sm:px-4 py-1 font-display font-extrabold text-sm sm:text-base whitespace-nowrap shadow-[inset_0_1px_0_rgba(255,255,255,0.45),0_6px_14px_-6px_rgba(0,0,0,0.8)] ${playerTurn ? 'text-night-950' : 'text-white'}`}
                    style={{ background: playerTurn ? PLAQUE_BRASS : PLAQUE_CRIMSON }}
                  >
                    Turn {turnCount}
                    <span className="mx-1.5 opacity-60" aria-hidden="true">·</span>
                    {playerTurn
                      ? <>{phase.charAt(0).toUpperCase() + phase.slice(1)}<span className="hidden min-[360px]:inline"> Phase</span></>
                      : `${OPPONENT_NAME}'s turn`}
                  </div>
                  <span className="h-px flex-1 bg-gradient-to-l from-transparent to-brass-300/45" aria-hidden="true" />
                  <span className="hidden lg:block w-32 shrink-0" aria-hidden="true" />
                </div>

                <div className="flex min-h-[1.5rem] max-w-full items-center justify-center">
                  {targetingMode ? (
                    <div className="relative flex items-center gap-1.5 rounded-full bg-red-950/90 px-3 py-1 text-xs font-bold text-red-100">
                      {/* The ring pulses, not the text, so the prompt keeps its
                          contrast at every point of the pulse. */}
                      <span className="absolute inset-0 rounded-full ring-1 ring-red-400/70 motion-safe:animate-pulse" aria-hidden="true" />
                      <Crosshair className="h-3.5 w-3.5" aria-hidden="true" />
                      Pick a victim for {selectedCard?.name}!
                    </div>
                  ) : latestLog && (
                    /* Latest-event ticker for screens without the log panel.

                       Purely visual: aria-hidden, because the sr-only log below
                       is the single announcer. This element used to BE the
                       announcer, carrying the only aria-live on the board —
                       with md:hidden on it. A live region inside a display:none
                       subtree is out of the accessibility tree, so on any
                       viewport >= 768px nothing was ever announced: a
                       screen-reader player pressed End Turn and was told
                       nothing about Chuck's plays, their creature dying, the
                       damage they took, or that it was their turn again. */
                    <div
                      aria-hidden="true"
                      className="md:hidden max-w-full truncate rounded-full bg-night-950/80 ring-1 ring-white/5 px-3 py-1 text-xs text-plush-200 pointer-events-none"
                    >
                      {latestLog}
                    </div>
                  )}
                </div>

                {/* The board's one announcer, present at every viewport and
                    visually hidden rather than display:none, so it is always in
                    the accessibility tree. A log of the recent entries, each
                    its own node, rather than one line of text: Chuck's attack
                    wave writes several entries in one render ("X UNSTUFFED Y",
                    then the face hit), and a single text node jumped straight
                    to the last of them, so a screen-reader player was never
                    told their creature had died. Each added node is announced. */}
                <div role="log" aria-live="polite" className="sr-only">
                  {battleLog.slice(-8).map((entry) => (
                    <div key={entry.id}>{entry.message}</div>
                  ))}
                </div>
              </div>

              {/* The player's half */}
              <div className="self-center flex justify-center items-start gap-2 sm:gap-3" style={{ zoom: fieldZoom }}>
                <AnimatePresence>
                {playerField.map((card) => {
                  const selected = selectedCard?.instanceId === card.instanceId;
                  const ready = playerTurn && phase === 'battle' && canAttack(card);
                  const resting = card.type === 'action' && !canAttack(card);
                  const cfx = fxFor(card.instanceId);
                  return (
                    <FieldSlot
                      key={card.instanceId}
                      initial={{ y: 30, opacity: 0, scale: 0.88 }}
                      animate={{ y: 0, opacity: 1, scale: 1 }}
                      exit={CRUMPLE_PLAYER}
                      transition={{ type: 'spring', stiffness: 380, damping: 26 }}
                      whileHover={{ y: -5 }}
                      className={`relative ${resting ? '' : 'cursor-pointer'}`}
                      /* Always delegate to selectCardForAttack rather than
                         short-circuiting here: it owns every rejection message
                         (trap / exhausted / summoning-sick), so a player who taps an
                         unavailable creature is told why instead of getting silence. */
                      press={pressable(() => selectCardForAttack(card), `Select ${card.name} to attack`, playerTurn && phase === 'battle')}
                    >
                      <div
                        ref={cardRef(card.instanceId)}
                        className={`relative rounded-[10px] transition-shadow ${selected
                          ? 'ring-2 ring-brass-300 shadow-[0_0_24px_4px_rgba(251,191,36,0.55)]'
                          : ready ? 'shadow-[0_0_18px_2px_rgba(52,211,153,0.5)]' : ''} ${cfx.hit ? 'fx-hit' : ''} ${cfx.strike === 'up' ? 'fx-strike-up' : ''}`}
                      >
                        {cfx.hit && <span key={cfx.hit.id} className="fx-flash" aria-hidden="true" />}
                        <div className={resting ? 'opacity-60' : ''}>
                          <TeddyCard teddy={card} cosmeticBorder={cosmeticBorder} lift={false} />
                        </div>
                        {card.stealthActive && <StealthBand />}
                        {card.ability === 'taunt' && !card.stealthActive && <TauntTag tone="player" />}
                      </div>
                      <StatusSlot>
                        {card.hasAttacked && <StatusChip>Exhausted</StatusChip>}
                        {card.summoningSick && !card.hasAttacked && <StatusChip>Warming Up</StatusChip>}
                      </StatusSlot>
                    </FieldSlot>
                  );
                })}
                </AnimatePresence>
              </div>

              {/* Numbers over the table: drawn here, at the position each card
                  had when its event fired, so a kill shows its number over the
                  card as it crumples away (see pushFx). */}
              {fx.some((e) => e.pos && e.text) && (
                <div aria-hidden="true" className="pointer-events-none absolute inset-0 z-30">
                  {fx.filter((e) => e.pos && e.text).map((e) => (
                    <FloatNumber key={e.id} fx={e} className="absolute" style={{ left: e.pos.x, top: e.pos.y }} />
                  ))}
                </div>
              )}

              {/* The turn banner (see its effect). Over the centre line, which
                  is empty of controls at a turn boundary. */}
              {banner && (
                <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-1/2 z-30 flex -translate-y-1/2 justify-center">
                  <div
                    key={banner.id}
                    className={`fx-banner rounded-xl px-8 py-2.5 font-display text-3xl font-extrabold tracking-tight shadow-[0_18px_40px_-14px_rgba(0,0,0,0.9)] sm:text-4xl ${banner.turn === 'player'
                      ? 'bg-night-950/90 ring-1 ring-brass-300/50'
                      : 'bg-night-950/90 ring-1 ring-red-400/50'}`}
                  >
                    {banner.turn === 'player'
                      ? <span className="text-brass-gradient">Your turn</span>
                      : <span className="text-red-300">{OPPONENT_NAME}&apos;s turn</span>}
                  </div>
                </div>
              )}

              {/* The player's emote bubble (Teddy Emote cosmetic), in the
                  felt's corner on their side — same decorative treatment as
                  Chuck's; the battle log carries the accessible record. */}
              <AnimatePresence>
                {playerQuip && (
                  <motion.div
                    key={playerQuip.id}
                    aria-hidden="true"
                    initial={{ opacity: 0, y: 8, scale: 0.9 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    transition={{ type: 'spring', stiffness: 350, damping: 22 }}
                    className="absolute bottom-2 left-2 sm:bottom-3 sm:left-3 z-20 max-w-[150px] sm:max-w-[220px] pointer-events-none"
                  >
                    {/* brass-200, not brass-100: the palette starts at 200, so
                        bg-brass-100 generated no CSS at all. The bubble was
                        transparent and its near-black text sat on the
                        near-black battlefield — a 1:1 contrast ratio.
                        src/tailwindShades.test.js now fails on any class
                        naming a shade the palette lacks. */}
                    <div className="relative bg-brass-200 text-night-900 text-xs sm:text-sm font-semibold rounded-2xl rounded-bl-sm px-3 py-2 shadow-[0_10px_24px_-8px_rgba(0,0,0,0.8)] ring-1 ring-brass-400/70">
                      <span className="mr-1">🎭</span>
                      {playerQuip.text}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Ability callout — names the rule a card just brought to the
                  table. Inside the felt so it centres on the table, not the
                  window (they differ by the log column at md+). Centred by a
                  plain wrapper: Framer Motion writes an inline transform for
                  y/scale, which silently replaced the -translate-x-1/2 this
                  used to carry, so the callout hung off to the right. */}
              <AnimatePresence>
                {showAbilityPopup && (
                  <div
                    key={`${showAbilityPopup.name}-${showAbilityPopup.ability}`}
                    className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-30 w-max max-w-[calc(100%-1rem)] pointer-events-none"
                  >
                    <motion.div
                      initial={{ opacity: 0, y: -16, scale: 0.85 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.9 }}
                      className="dialog-panel rounded-xl px-5 py-3 text-center"
                    >
                      <div className="label-caps text-brass-300">{showAbilityPopup.ability}</div>
                      <div className="font-display text-lg font-extrabold text-white">{showAbilityPopup.name}</div>
                      <div className="text-sm text-plush-200">{getAbilityDescription(showAbilityPopup.ability)}</div>
                    </motion.div>
                  </div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* Beside the table from md up; rows under it on phones. */}
          <div className="shrink-0 flex flex-col gap-2 md:gap-3 md:w-56 md:pb-1">
            {/* Battle log — a panel from md up; phones get the ticker on the
                centre line instead, since a panel there would cover cards.
                tabIndex + role/aria-label make the scrolling panel keyboard-
                reachable (axe: scrollable-region-focusable), and the region
                itself is the scroller, which axe requires. It has no aria-live
                of its own; the sr-only log on the table is the one announcer.
                Newest first, so the entry that just happened is in view. */}
            <div
              role="region"
              aria-label="Battle log"
              tabIndex={0}
              className="hidden md:block flex-1 min-h-0 overflow-y-auto panel-glass rounded-xl p-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass-400"
            >
              <div className="flex items-center gap-1.5 mb-2 text-brass-300">
                <ScrollText className="h-3.5 w-3.5" aria-hidden="true" />
                <span className="label-caps">Battle Log</span>
              </div>
              {[...battleLog].reverse().map((entry, i) => (
                <div
                  key={entry.id}
                  className={`text-xs leading-snug py-1.5 border-b border-white/[0.06] last:border-0 ${i === 0 ? 'text-plush-100' : 'text-plush-300'}`}
                >
                  {entry.message}
                </div>
              ))}
            </div>

            {/* Battle Pass emote cosmetics — only rendered once unlocked, on a
                line of their own so the turn controls below never wrap around
                them. Usable on either turn (heckling Chuck mid-swing is the
                point). */}
            {!gameOver && emotes.length > 0 && (
              <div className="flex flex-row justify-center gap-2">
                {emotes.map((emote) => (
                  <button
                    type="button"
                    key={emote.name}
                    onClick={() => sendEmote(emote)}
                    aria-label={emote.name}
                    title={emote.name}
                    className="btn-glass flex-none grid place-items-center h-10 w-10 rounded-xl text-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass-300"
                  >
                    {emote.icon}
                  </button>
                ))}
              </div>
            )}

            {/* Game controls. The line keeps its height on Chuck's turn, when
                the buttons are gone: below md the table's height depends on
                it, and an empty line made the whole table grow and shrink at
                every turn boundary. Concede is icon-only on phones so that
                Rally + Battle + End Turn + Concede fit one line at 360px. */}
            <div className="flex min-h-10 flex-row flex-wrap items-center justify-center gap-2 md:flex-col md:items-stretch">
              {!gameOver && !playerTurn && (
                <span className="text-xs italic text-plush-300" aria-hidden="true">
                  {OPPONENT_NAME} is making his move…
                </span>
              )}
              {targetingMode && (
                <button type="button" className={`${ACTION} btn-glass`} onClick={cancelTargeting}>
                  Cancel
                </button>
              )}
              {!gameOver && playerMomentum >= MOMENTUM_MAX && playerTurn && (
                <button type="button" className={`${ACTION} btn-brass foil relative`} onClick={rally}>
                  {/* Above the foil band (::after), which would otherwise
                      sweep across the label and wash it out. */}
                  <span className="relative z-10">⚡ Rally!</span>
                </button>
              )}
              {!gameOver && phase === 'main' && playerTurn && (
                <button type="button" className={`${ACTION} btn-brass`} onClick={goToBattlePhase}>
                  ⚔️ Battle
                </button>
              )}
              {!gameOver && (phase === 'main' || phase === 'battle') && playerTurn && (
                <button
                  type="button"
                  className={`${ACTION} ${phase === 'battle' ? 'btn-brass' : 'btn-glass'}`}
                  onClick={endTurn}
                >
                  End Turn
                </button>
              )}
              {!gameOver && playerTurn && (
                <button
                  type="button"
                  title="Concede"
                  className={`${ACTION} btn-glass !px-3 sm:!px-4 text-plush-300 hover:text-white text-xs md:mt-1`}
                  onClick={concedeGame}
                >
                  <Flag className="h-3.5 w-3.5" aria-hidden="true" />
                  <span className="sr-only sm:not-sr-only">Concede</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Player's hand — scrolls horizontally so a full hand stays reachable
            on phones. The cards sit in a w-max mx-auto strip rather than using
            justify-center on the scroller: centred overflow spills to both
            sides and the left side cannot be scrolled to, which hid the first
            cards of a big hand. The padding is the room a hovered card lifts
            into and the fan's outer corners swing into; overflow-y is hidden so
            the lift never summons a vertical scrollbar. */}
        <div className="board-zoom shrink-0 max-w-full overflow-x-auto overflow-y-hidden px-6 pt-11 pb-6">
          <div className="mx-auto flex w-max gap-2">
            <AnimatePresence>
              {playerHand.map((card, index) => {
                const mid = (playerHand.length - 1) / 2;
                // Tighter fan for big hands, so the outer cards' corners
                // stay inside the row.
                const step = playerHand.length > 6 ? 2 : 3;
                const affordable = playerEnergy >= effectiveCost(card, playerField);
                const playable = playerTurn && phase === 'main';
                return (
                  <motion.div
                    key={card.instanceId}
                    initial={{ y: 50, opacity: 0 }}
                    animate={{ y: Math.abs(index - mid) * step, opacity: 1, rotate: (index - mid) * step }}
                    exit={{ y: 50, opacity: 0 }}
                    whileHover={{ y: -20, scale: 1.08, zIndex: 10 }}
                    style={{ transformOrigin: 'bottom center' }}
                    className={`shrink-0 rounded-[10px] cursor-pointer ${!affordable
                      ? 'opacity-50 saturate-50'
                      : playable ? 'shadow-[0_0_16px_1px_rgba(251,191,36,0.4)]' : ''}`}
                    {...pressable(() => playCard(card), `Play ${card.name}`, playable)}
                  >
                    <TeddyCard teddy={card} cosmeticBorder={cosmeticBorder} lift={false} />
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        </div>

        {/* Player's rail */}
        <div className="hud-player shrink-0 h-[calc(3.5rem+env(safe-area-inset-bottom))] sm:h-[calc(4rem+env(safe-area-inset-bottom))] pb-[env(safe-area-inset-bottom)] flex items-center justify-between gap-2 px-3 sm:px-5">
          <div className="flex items-center gap-2.5 min-w-0">
            <Avatar ring={RARITY_METAL.legendary} />
            <div className="min-w-0">
              <div className="font-display font-extrabold text-white leading-tight truncate max-w-[7rem] sm:max-w-none">{playerName}</div>
              <div className="text-emerald-200/80 text-[11px] whitespace-nowrap">Deck: {playerDeck.length} | Hand: {playerHand.length}</div>
            </div>
            {/* Player's draw pile */}
            {playerDeck.length > 0 && (
              <div className="relative w-8 h-11 shrink-0 hidden sm:block" aria-hidden="true">
                <div className="absolute inset-0 -rotate-6"><CardBack className="w-8 h-11" mini /></div>
                <div className="absolute inset-0 rotate-3"><CardBack className="w-8 h-11" mini /></div>
                <CardBack className="w-8 h-11" mini />
              </div>
            )}
          </div>
          <div className="flex items-center gap-2 sm:gap-5">
            <span
              role="img"
              aria-label={storeSoundEnabled ? 'Sound on' : 'Sound off'}
              title={storeSoundEnabled ? 'Sound on' : 'Sound off'}
              className="grid h-7 w-7 sm:h-8 sm:w-8 place-items-center rounded-full bg-black/30 ring-1 ring-white/10 text-plush-300"
            >
              {storeSoundEnabled
                ? <Volume2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" aria-hidden="true" />
                : <VolumeX className="h-3.5 w-3.5 sm:h-4 sm:w-4" aria-hidden="true" />}
            </span>
            <div className="flex items-center gap-1.5">
              <span
                className="grid h-7 w-7 place-items-center rounded-full shadow-[inset_0_1px_0_rgba(255,255,255,0.6),0_3px_8px_-3px_rgba(0,0,0,0.8)]"
                style={{ background: PLAQUE_BRASS }}
                aria-hidden="true"
              >
                <Zap className="h-4 w-4 text-night-950" fill="currentColor" />
              </span>
              <span className="font-display text-xl font-extrabold text-white tabular-nums">{playerEnergy}</span>
              <span className="sr-only">energy</span>
            </div>
            <HealthMeter
              hp={playerHealth}
              max={30}
              fx={faceFx('player')}
              fill="[&>div]:bg-gradient-to-r [&>div]:from-emerald-600 [&>div]:to-emerald-300"
              label={`Your health: ${playerHealth} of 30`}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default GameBoard;
