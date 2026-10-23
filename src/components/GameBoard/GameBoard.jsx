import { useState, useEffect, useCallback, useRef, createContext, useContext, forwardRef, useImperativeHandle } from 'react';
import {
  Coins, Crosshair, Crown, Flag, Ghost, Hand, Heart, HeartCrack, Layers, ScrollText, Smartphone, Star, Trophy, Volume2, VolumeX, Zap,
} from 'lucide-react';
import TeddyCard, { CardBack } from '../TeddyCard';
import { Progress } from "@/components/ui/progress";
import { RARITY_METAL } from '@/lib/rarity';
import { useToast } from "@/components/ui/use-toast";
import { motion, AnimatePresence, useIsPresent, useReducedMotionConfig } from 'framer-motion';
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
import { abilityRules } from '@/lib/abilities';
import { MAX_HAND_SIZE, MAX_FIELD_SIZE, MOMENTUM_MAX, canRally, energyForTurn, hasMoveLeft, isUsefulPlay } from './turn';
import LeaveBattleDialog from './LeaveBattleDialog';
import { battlePassTier } from './battlePassTiers';
import { Medallion } from '@/components/ui/game-chrome';
import { FOCUS_OUTLINE, FOCUS_RING } from '@/lib/focus';

// Stamp a creature's starting durability when it enters the field. `defense` is
// the HP pool in the creature-HP combat model; `currentHp` tracks the remaining
// pool as it takes hits (see resolveCreatureHit).
const withHp = (card) => ({ ...card, currentHp: card.defense });

const PLAYER_MAX_HEALTH = 30;

// Board metals. Brass is the player's (and the plaque on their turn); crimson
// is Chuck's.
const PLAQUE_BRASS = 'linear-gradient(180deg, #fde68a 0%, #fbbf24 45%, #d97706 100%)';
const PLAQUE_CRIMSON = 'linear-gradient(180deg, #ef4444 0%, #b91c1c 50%, #7f1d1d 100%)';
const OPPONENT_RING = 'linear-gradient(145deg, #fecaca 0%, #b91c1c 40%, #f87171 65%, #7f1d1d 100%)';

// Shared shape of every board control; the material (btn-brass / btn-glass)
// is added per button. Plain <button>s rather than the shadcn Button, whose
// bg-primary is a utility and would beat a component-layer material. 44px
// tall, the smallest comfortable touch target. FOCUS_OUTLINE, not a ring: a
// ring is a box-shadow and would replace the material's own (the brass lip,
// the glass rim) for as long as the control has focus.
const ACTION =
  'inline-flex items-center justify-center gap-1.5 h-11 px-4 md:w-full rounded-xl font-display font-bold ' +
  `text-sm sm:text-base whitespace-nowrap ${FOCUS_OUTLINE}`;

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

// The board's live combat events (see pushFx), for the cards and meters that
// draw them. Context rather than props on purpose: a card that has just died
// is still on screen for its exit, rendered by AnimatePresence from the
// element it had BEFORE it died — props frozen without the killing blow — but
// a context value still reaches it, so the dying card can draw its own hit.
const FxContext = createContext([]);

// How a creature leaves the table: a flash, then it crumples and drops away
// toward its own side. The slot is held (invisible) for the rest of FX_MS, so
// its number finishes over the spot where it died instead of over whichever
// neighbour slides into it. With reduced motion — the OS setting, or the
// Animations switch through MotionConfig — it only fades, still holding the
// slot.
const exitFor = (side, reduced) => (reduced
  ? { opacity: [1, 0, 0], transition: { duration: FX_MS / 1000, times: [0, 0.3, 1] } }
  : {
      opacity: [1, 1, 0, 0],
      scale: [1, 1, 0.6, 0.6],
      rotate: [0, 0, side === 'player' ? 8 : -8, side === 'player' ? 8 : -8],
      y: [0, 0, side === 'player' ? 24 : -24, side === 'player' ? 24 : -24],
      filter: ['grayscale(0) brightness(1)', 'grayscale(0) brightness(1)', 'grayscale(1) brightness(0.6)', 'grayscale(1) brightness(0.6)'],
      transition: { duration: FX_MS / 1000, times: [0, 0.12, 0.5, 1], ease: 'easeIn' },
    });

// A floating number: "−3" over a struck card, "+5" over a healed face. Pure
// decoration — the battle log is the accessible record of every hit — and the
// motion is CSS (index.css, .fx-float), so it stops with the Animations
// switch and reduced motion.
const FX_TONE = {
  damage: 'text-red-300',
  heal: 'text-emerald-300',
  buff: 'text-brass-200',
};
const FloatNumber = ({ fx, className = '' }) => (
  <span
    className={`fx-float font-display text-[26px] font-extrabold leading-none tabular-nums ${FX_TONE[fx.tone] ?? FX_TONE.damage} ${className}`}
    style={{ '--fx-i': fx.stack ?? 0 }}
  >
    {fx.text}
  </span>
);

// The newest hit in a list of events, and a class that restarts the shake for
// each new one: re-adding the same class name does not replay a CSS animation,
// so two hits inside FX_MS alternate between two identical keyframe names.
const latestHit = (events) => events.reduce((last, e) => (e.hit && (!last || e.id > last.id) ? e : last), null);
const shakeClass = (hit) => (hit ? (hit.id % 2 ? 'fx-hit' : 'fx-hit-alt') : '');

const HealthMeter = ({ hp, max, fill, label, side }) => {
  // This side's face events. A hit shakes the meter; the number floats off it
  // — up from your rail, and in place to the left of Chuck's (his rail is the
  // top edge of the screen, and drifting down would put it under the toast
  // dock). The numbers sit OUTSIDE the shaking element: a transform makes a
  // stacking context, which would trap them under the table for the shake.
  const events = useContext(FxContext).filter((e) => e.face === side);
  const hit = latestHit(events);
  const numbers = events.filter((e) => e.text);
  return (
    <div className="relative">
      {numbers.length > 0 && (
        <span
          aria-hidden="true"
          className={`pointer-events-none absolute z-30 ${side === 'opponent' ? 'right-full top-1/2 mr-4 fx-in-place' : 'bottom-full right-8 mb-1 fx-above'}`}
        >
          {numbers.map((e) => <FloatNumber key={e.id} fx={e} className="absolute" />)}
        </span>
      )}
      <div className={`flex flex-col items-end gap-1 ${shakeClass(hit)}`}>
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
    </div>
  );
};

// A creature on the table, and everything combat draws on it: its numbers,
// its shake and red flash when hit, its lunge when it attacks, and — when it
// dies — the crumple. AnimatePresence keeps a dead card on screen through
// its exit, rendered from its last props; while it exits (useIsPresent false)
// it is out of the tab order and the accessibility tree, takes no taps, and
// stops showing the target ring and crosshair it may have been drawn with
// (data-exiting; index.css). Its effects come from FxContext, which still
// reaches it, so the killing blow shows on the card that took it.
const FieldSlot = ({ cardId, side, press, className = '', children, ...motionProps }) => {
  const present = useIsPresent();
  const reduced = useReducedMotionConfig();
  const events = useContext(FxContext).filter((e) => e.card === cardId);
  const hit = latestHit(events);
  const strike = events.some((e) => e.strike);
  const numbers = events.filter((e) => e.text);
  const cls = present ? className : `${className.replace('cursor-crosshair', '')} pointer-events-none`;
  return (
    <motion.div
      {...motionProps}
      exit={exitFor(side, reduced)}
      className={cls}
      {...(present ? press : { inert: '', 'aria-hidden': true, 'data-exiting': '' })}
    >
      <div className={`relative ${shakeClass(hit)} ${strike ? (side === 'player' ? 'fx-strike-up' : 'fx-strike-down') : ''}`}>
        {children}
        {hit && <span key={hit.id} className="fx-flash" aria-hidden="true" />}
      </div>
      {numbers.length > 0 && (
        <span aria-hidden="true" className="pointer-events-none absolute left-1/2 top-[3.75rem] z-30">
          {numbers.map((e) => <FloatNumber key={e.id} fx={e} className="absolute" />)}
        </span>
      )}
    </motion.div>
  );
};

// A card in the hand. A played card animates out, and AnimatePresence keeps
// it on screen meanwhile with the props it last had — its click handler
// included, which still saw it in the hand — so a second tap during the exit
// played the same card again: energy spent twice, and two copies on the table
// sharing one id. While it leaves it takes no taps, no focus and no place in
// the accessibility tree, as a dying FieldSlot does.
const HandSlot = ({ press, className = '', children, ...motionProps }) => {
  const present = useIsPresent();
  return (
    <motion.div
      {...motionProps}
      className={present ? className : `${className} pointer-events-none`}
      {...(present ? press : { inert: '', 'aria-hidden': true })}
    >
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
// a card (h-36), and per card a w-24 slot with the sm gap between them. The
// row used to reserve 24px more under every card for its status chip, which
// on a 320x640 phone held the rows at 0.59 — names at 5.3px.
const FIELD_ROW_HEIGHT = 144;
const FIELD_SLOT = 96;
const FIELD_GAP = 12;

// The hand at zoom 1: a w-24 card, and the gap-2 after it. A hand wider than
// the screen overlaps its cards (see fitHand) rather than scrolling, down to a
// visible strip of HAND_MIN_STRIP — never under 44 screen pixels to tap, and
// never under 52 layout pixels, where the next card would start covering this
// one's centre (which is where a click, Playwright's included, lands).
const HAND_CARD = 96;
const HAND_STEP = HAND_CARD + 8;
const HAND_MIN_STRIP = 52;
const TOUCH_TARGET = 44;

// The hand's fan: each card turns this many degrees (and drops this many
// pixels) per place from the middle — tighter from six cards, so the outer
// corners stay inside the row and leave the overlap room to fit a phone.
const fanStep = (count) => (count > 5 ? 2 : 3);
// How far the outermost card's top corner swings past its own edge, at the
// 1.08 hover lift: the room the strip keeps at each end so the fan never
// makes it scroll.
const fanOverhang = (count) => {
  const turn = (((count - 1) / 2) * fanStep(count) * Math.PI) / 180;
  const half = HAND_CARD / 2;
  return Math.ceil((144 * Math.sin(turn) + half * Math.cos(turn) - half) * 1.08) + 1;
};

// How long a mouse rests on a card before its enlarged preview opens, and how
// long a finger holds a table card for the same. The hover delay keeps the
// preview from flashing up under every card the pointer crosses on its way
// to a play.
const PREVIEW_HOVER_MS = 350;
const LONG_PRESS_MS = 450;

/**
 * A card at full size, for reading it. Board cards are scaled to fit the felt
 * (to 0.64 on a 320px phone) and hand cards overlap, so neither can always be
 * read where it lies. Opened by hovering a card with a mouse, focusing it from
 * the keyboard, holding a table card down, or the first tap on a hand card on
 * a touch screen. Drawn at the hand layout (cost, rarity, rules line) with the
 * ability's rules text beneath it.
 *
 * Decorative — aria-hidden and transparent to the pointer — because what it
 * shows is already the card's own content and the battle log's, and the
 * card's accessible name stays the control's. `place` is 'right' where the
 * felt has room beside its rows, else 'centre'.
 */
const CardPreview = ({ card, place, zoom, costDelta = 0, cosmeticBorder = null }) => {
  const rules = card.ability && card.ability !== 'none' ? abilityRules(card.ability) : '';
  const placement = place === 'right' ? 'right-3 sm:right-5' : 'inset-x-0 justify-center';
  return (
    <div
      aria-hidden="true"
      data-card-preview={place}
      className={`pointer-events-none absolute inset-y-0 z-40 flex items-center ${placement}`}
    >
      <div className="flex flex-col items-center gap-2" style={{ width: Math.max(160, Math.round(96 * zoom)) }}>
        <div className="rounded-[10px] shadow-[0_24px_48px_-12px_rgba(0,0,0,0.9)]" style={{ zoom }}>
          <TeddyCard teddy={card} lift={false} cosmeticBorder={cosmeticBorder} costDelta={costDelta} artVariant="responsive" artLoading="eager" />
        </div>
        {rules && (
          <div className="w-full rounded-lg bg-night-950/95 px-3 py-2 text-center ring-1 ring-white/10 shadow-[0_10px_24px_-8px_rgba(0,0,0,0.8)]">
            <div className="label-caps text-brass-300">{card.ability}</div>
            <div className="mt-0.5 text-xs leading-snug text-plush-100">{rules}</div>
          </div>
        )}
      </div>
    </div>
  );
};

// What a raised hand card says it will do on a second tap (touch screens,
// where the first tap only raises it). Not a control: the card is.
const RaisedHint = ({ children }) => (
  <span
    aria-hidden="true"
    className="pointer-events-none absolute -top-3 left-1/2 z-20 -translate-x-1/2 whitespace-nowrap rounded-full bg-night-950/95 px-2 py-0.5 text-[10px] font-bold leading-[14px] text-brass-200 ring-1 ring-brass-300/60 shadow-[0_4px_10px_-2px_rgba(0,0,0,0.8)]"
  >
    {children}
  </span>
);

// "Warming Up" / "Exhausted", across the lower part of the card, above its
// stats — over the art rather than in a slot reserved below it. Outside the
// card's own dimming, so it keeps its contrast on a resting card. The e2e
// suite counts those words exactly, so each state renders them in a
// StatusChip and nowhere else.
const StatusChip = ({ children }) => (
  <div className="pointer-events-none absolute inset-x-0 bottom-[37px] z-10 flex justify-center">
    <span className="rounded-full bg-night-950/90 ring-1 ring-white/15 px-2 py-0.5 text-[10px] leading-[14px] font-semibold text-plush-100 whitespace-nowrap shadow-[0_2px_6px_rgba(0,0,0,0.6)]">
      {children}
    </span>
  </div>
);

// Untracked: the rows are scaled to fit the felt (0.64 on a 320px phone), and
// letter-spaced capitals that small split apart at 1x, as the card's old 6px
// rarity line did ("COMM ON").
const StealthBand = () => (
  <div className="absolute inset-x-0 top-[27px] z-10 flex items-center justify-center gap-1 bg-purple-700/90 py-0.5 text-[10px] font-bold leading-[14px] text-white">
    <Ghost className="h-2.5 w-2.5" aria-hidden="true" />
    STEALTH
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

// A reward figure that counts up from zero as the result panel opens. With
// reduced motion — the OS setting, or the Animations switch through
// MotionConfig — it shows the figure at once. Visual only: the caller puts
// the final figure in sr-only text, so a screen reader never hears a count.
const CountUp = ({ value, delay = 0, duration = 700 }) => {
  const reduced = useReducedMotionConfig();
  const [shown, setShown] = useState(reduced ? value : 0);
  useEffect(() => {
    if (reduced) {
      setShown(value);
      return undefined;
    }
    let frame = 0;
    let start = null;
    const tick = (now) => {
      start ??= now;
      const t = Math.min(1, (now - start) / duration);
      setShown(Math.round(value * (1 - (1 - t) ** 3)));
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    const timer = setTimeout(() => { frame = requestAnimationFrame(tick); }, delay);
    return () => {
      clearTimeout(timer);
      cancelAnimationFrame(frame);
    };
  }, [value, delay, duration, reduced]);
  return <span aria-hidden="true" data-count-up="">{shown.toLocaleString()}</span>;
};

// When the result panel's beats land, in seconds: the chips pop, the XP bar
// fills, then the level-up (if any) arrives as the bar tops out.
const REWARD_BEATS = { xp: 0.3, coins: 0.5, bar: 0.7, levelUp: 1.6 };

/**
 * The XP bar under the result's reward chips: the level's progress from where
 * the battle started to where it ended. On a level-up it fills to the end,
 * empties and fills again into the new level. The fill is a transform
 * (scaleX from its left edge), which Framer Motion owns and the compositor
 * runs, never a width; with reduced motion it simply shows where it ended.
 */
const XpBar = ({ progress }) => {
  const { xpBefore, xpNeededBefore, xpAfter, xpNeededAfter, levelAfter, levelsGained } = progress;
  const from = Math.min(1, xpBefore / xpNeededBefore);
  const to = Math.min(1, xpAfter / xpNeededAfter);
  const levelled = levelsGained > 0;
  return (
    <div className="mx-auto mt-3 max-w-[16rem]">
      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={xpNeededAfter}
        aria-valuenow={xpAfter}
        aria-label={`Level ${levelAfter}: ${xpAfter} of ${xpNeededAfter} XP`}
        className="panel-glass h-2.5 overflow-hidden rounded-full"
      >
        <motion.div
          data-xp-fill=""
          className="h-full rounded-full bg-gradient-to-r from-brass-500 to-brass-300 shadow-[0_0_8px_rgba(251,191,36,0.6)]"
          style={{ originX: 0 }}
          initial={{ scaleX: from }}
          animate={{ scaleX: levelled ? [from, 1, 0, to] : to }}
          transition={{
            delay: REWARD_BEATS.bar,
            duration: levelled ? 1.3 : 0.8,
            ease: 'easeOut',
            ...(levelled ? { times: [0, 0.6, 0.61, 1] } : {}),
          }}
        />
      </div>
      <div aria-hidden="true" className="mt-1 flex justify-between text-[11px] font-semibold tabular-nums text-plush-300">
        <span>Lv {levelAfter}</span>
        <span>{xpAfter.toLocaleString()} / {xpNeededAfter.toLocaleString()} XP</span>
      </div>
    </div>
  );
};

// The level-up beat on the result panel: the new level on a brass medallion,
// and the coins the level-up paid — credited all along, and never shown
// anywhere until now. With reduced motion it is simply there: Framer Motion's
// reduced motion stops transforms but still runs an opacity fade, delay and
// all, which held the row invisible for 1.6s.
const LevelUpRow = ({ level, bonusCoins }) => {
  const reduced = useReducedMotionConfig();
  return (
    <motion.div
      data-level-up=""
      initial={reduced ? false : { opacity: 0, scale: 0.85 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: REWARD_BEATS.levelUp, type: 'spring', stiffness: 320, damping: 18 }}
      className="mt-3 flex items-center justify-center gap-3"
    >
      <Medallion size="sm">
        <span className="font-display text-lg font-extrabold leading-none text-brass-200">{level}</span>
      </Medallion>
      <div className="text-left">
        <div className="label-caps text-brass-300">Level up</div>
        <div className="font-display text-xl font-extrabold leading-tight text-white">Level {level}</div>
      </div>
      <div className="panel-glass flex items-center gap-1.5 rounded-xl px-3 py-2">
        <Coins className="h-4 w-4 text-brass-300" aria-hidden="true" />
        <span className="font-display text-base font-extrabold tabular-nums text-white">+{bonusCoins.toLocaleString()}</span>
        <span className="sr-only">bonus coins</span>
      </div>
    </motion.div>
  );
};

// The result panel's figures, from what recordBattleResult reported (or
// nothing yet): the battle's XP and coins, addXP's account of the level, and
// the Battle Pass tier either side of the XP.
const rewardsFrom = (result) => {
  const progress = result?.progress ?? null;
  return {
    xp: result?.xpGain ?? 0,
    coins: result?.coinsGain ?? 0,
    progress,
    tierBefore: progress ? battlePassTier(progress.seasonXPBefore) : 0,
    tierAfter: progress ? battlePassTier(progress.seasonXPAfter) : 0,
  };
};

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
 * Card abilities and their rules text: src/lib/abilities.js.
 *
 * The ref exposes `requestLeave()`: the same "leave this battle?" path the
 * board's "← Menu" takes, for a caller outside the board (a browser Back
 * handler). While a game is live it asks first; once the game is over, or
 * before it has dealt, it leaves at once.
 */
const GameBoard = forwardRef(function GameBoard({ onBackToMenu, onOpenShop }, ref) {
  // Get store data
  const {
    currentDeck,
    difficulty: aiDifficulty,
    soundEnabled: storeSoundEnabled,
    setSoundEnabled,
    currentWinStreak,
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

  // A battle that levelled the player up: the result panel announces it
  // (LevelUpRow), so it comes off the store's queue — App would otherwise
  // toast it too once the player is back on the menu — and confetti marks
  // the beat the bar tops out. celebrate() honours the Animations switch and
  // reduced motion. A battle abandoned through "← Menu" never gets here, and
  // App's toast is then its only announcement.
  const showLevelUp = useCallback((progress) => {
    if (!progress?.levelsGained) return;
    useGameStore.getState().dismissLevelUp(progress.levelUpId);
    safeTimeout(() => celebrate({
      particleCount: 90,
      spread: 70,
      startVelocity: 35,
      origin: { y: 0.55 },
      colors: ['#fde68a', '#fbbf24', '#f59e0b', '#ffffff'],
    }), REWARD_BEATS.levelUp * 1000);
  }, [safeTimeout]);

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
  // 'draw' for the moment the turn's card arrives, 'main' for the rest of
  // the player's turn (play cards and attack, in any order), 'end' once it
  // has been handed to Chuck.
  const [phase, setPhase] = useState('draw');
  const [currentTurn, setCurrentTurn] = useState('player');
  const [turnCount, setTurnCount] = useState(1);

  // Player state
  const [playerHealth, setPlayerHealth] = useState(PLAYER_MAX_HEALTH);
  const [playerEnergy, setPlayerEnergy] = useState(energyForTurn(1));
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
  const [battleRewards, setBattleRewards] = useState(() => rewardsFrom(null));

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
  // Replace the log outright, for the start of a game.
  const startBattleLog = useCallback((messages) => {
    setBattleLog(messages.map((message) => {
      logIdRef.current += 1;
      return { id: logIdRef.current, message };
    }));
  }, []);

  // Chuck's trash talk: a transient speech bubble ({id, text}) plus his parting
  // shot on the game-over screen. Decorative flavor — aria-hidden, the battle
  // log stays the accessible record.
  const [oppQuip, setOppQuip] = useState(null);
  const [endQuip, setEndQuip] = useState(null);
  const quipIdRef = useRef(0);
  // One counter across both mouths, so the centre line can show whichever
  // spoke last when Chuck and the player's emote are up together.
  const speechSeqRef = useRef(0);
  const lastQuipRef = useRef(null);
  const nearDeathQuippedRef = useRef(false);

  // Snapshot of the in-progress state for the unmount handler below — a cleanup
  // closes over its mount-time values, so it must read the latest through a ref.
  const liveRef = useRef({ gameOver, deckReady, playerHealth });
  liveRef.current = { gameOver, deckReady, playerHealth };

  // Leaving a battle mid-game counts as a loss. Leaving through "← Menu" (once
  // the player confirms it, see requestLeave) simply unmounts the board — with
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
        setBattleRewards(rewardsFrom(abandonRewardsRef.current));
        showLevelUp(abandonRewardsRef.current.progress);
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
    // clearAllTimeouts and showLevelUp are stable useCallbacks (their own
    // dependencies never change), so this still runs once.
  }, [clearAllTimeouts, showLevelUp]);

  // Giving up a live battle asks first (LeaveBattleDialog). `leaveMode` is
  // which control asked — 'leave' ("← Menu") or 'concede' — or null.
  const [leaveMode, setLeaveMode] = useState(null);
  const onBackToMenuRef = useRef(onBackToMenu);
  onBackToMenuRef.current = onBackToMenu;
  // Stable, and reads the live game through liveRef, so a caller holding it
  // (the ref handle below) never acts on a stale idea of whether the game is
  // still being played.
  const requestLeave = useCallback(() => {
    const { gameOver: over, deckReady: ready } = liveRef.current;
    if (ready && !over) setLeaveMode('leave');
    else onBackToMenuRef.current?.();
  }, []);
  useImperativeHandle(ref, () => ({ requestLeave }), [requestLeave]);
  // The game can end with the question still open — Chuck's turn plays on
  // behind it — and then the result dialog is the only thing to answer.
  useEffect(() => {
    if (gameOver) setLeaveMode(null);
  }, [gameOver]);

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
    setPlayerQuip({ id, text, seq: ++speechSeqRef.current });
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
    setOppQuip({ id, text, seq: ++speechSeqRef.current });
    // Logged like the player's emotes. The bubble is gone in three seconds
    // and, on a phone, clipped to two lines, so the log is where the whole
    // line stays readable (from md up), and the only place a screen reader
    // hears it: every bubble is aria-hidden.
    addToBattleLog(`🧸 ${OPPONENT_NAME}: "${text}"`);
    // Dismiss via the tracked-timeout system so restart/concede/unmount cancel
    // it; only clear if a newer quip hasn't already replaced this one.
    safeTimeout(() => {
      setOppQuip((q) => (q && q.id === id ? null : q));
    }, 3200);
  }, [safeTimeout, addToBattleLog]);

  // Combat feedback. Each event is a short-lived record of something that
  // just happened on the table — an attacker striking, a card taking a hit or
  // dying, a face hit, a heal or a buff — that the cards and meters turn into
  // a lunge, a shake and flash, a crumple, a floating number (FieldSlot and
  // HealthMeter, through FxContext). Decorative: the battle log and its live
  // region are the accessible record of the same events, and no game state
  // waits on any of it.
  //
  // Each number is given its stack position when it is pushed, from the
  // numbers already live on the same card or face: several in one wave stack
  // instead of overlapping, and a live one never jumps when an older one goes.
  const feltRef = useRef(null);
  const centreRef = useRef(null);
  const [fx, setFx] = useState([]);
  const fxIdRef = useRef(0);
  const pushFx = useCallback((events) => {
    if (!events.length) return;
    const withIds = events.map((e) => ({ ...e, id: ++fxIdRef.current }));
    setFx((prev) => {
      const next = new Map();
      for (const e of prev) {
        if (!e.text) continue;
        const key = e.card ?? `face:${e.face}`;
        next.set(key, Math.max(next.get(key) ?? 0, e.stack + 1));
      }
      return [...prev, ...withIds.map((e) => {
        if (!e.text) return { ...e, stack: 0 };
        const key = e.card ?? `face:${e.face}`;
        const stack = next.get(key) ?? 0;
        next.set(key, stack + 1);
        return { ...e, stack };
      })];
    });
    const ids = new Set(withIds.map((e) => e.id));
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

  // Asking whether to leave retires any open callout. Toasts sit above every
  // dialog, and on a phone on the centre line, which is where the leave
  // dialog's medallion and title land: a refusal ("Still finding the floor —
  // …"), often the very thing that makes a player give up, otherwise sat on
  // the question for up to 7 s. Here rather than in each control that opens
  // it, so a caller of requestLeave from outside the board is covered too.
  useEffect(() => {
    if (leaveMode) dismissToasts();
  }, [leaveMode, dismissToasts]);

  // From md up a battle toast docks at the top of the log column (index.css),
  // and the log steps down to make room for it instead of lying under it: the
  // toasts left are mostly rule explanations, which are not logged, and
  // docked over the log they hid exactly its newest lines. The height is the
  // toast list's own, measured, so the room always matches what is showing.
  const [toastRoom, setToastRoom] = useState(0);
  useEffect(() => {
    const list = document.querySelector('.toast-viewport');
    if (!list || typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(() => setToastRoom(Math.round(list.getBoundingClientRect().height)));
    observer.observe(list);
    return () => observer.disconnect();
  }, []);

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
      // Game over cancels every tracked timer, these effects' removal among
      // them, so they would otherwise stay drawn under the result dialog.
      setFx([]);
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

    // A fresh log at every deal, rather than appending to whatever is there.
    // Everything above replaces state, so this effect can run twice and end
    // the same — and in development it does: StrictMode mounts, unmounts and
    // remounts, and appending showed the intro twice, the first copy naming
    // a crew from the throwaway deal that is not the one in play. (The two
    // lines after it append to that fresh log, so a second run still ends
    // with one copy of each.) Chuck's opening line goes between the intro and
    // the hand-over, in the order it is said.
    startBattleLog([
      `${OPPONENT_NAME} slams his deck on the table with ${crewName} at his back. Difficulty: ${aiDifficulty.toUpperCase()}`,
    ]);
    speak('gameStart');
    addToBattleLog('Your turn. Make it hurt.');
    setDeckReady(true);
  }, [startBattleLog, addToBattleLog, currentDeck, aiDifficulty, gameId, speak]);

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
      const result = recordBattleResult(
        true,
        battleStatsRef.current.damageDealt,
        battleStatsRef.current.healingDone,
        playerHealth,
        battleStatsRef.current.cardsPlayed,
        battleStatsRef.current.damageTaken
      );
      const { coinsGain } = result;
      setBattleRewards(rewardsFrom(result));
      showLevelUp(result.progress);

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
      const result = recordBattleResult(
        false,
        battleStatsRef.current.damageDealt,
        battleStatsRef.current.healingDone,
        playerHealth,
        battleStatsRef.current.cardsPlayed
      );
      const { coinsGain } = result;
      setBattleRewards(rewardsFrom(result));
      showLevelUp(result.progress);

      // Sync to server (fire and forget - don't block UI)
      syncBattleResult(false, battleStatsRef.current.damageDealt, battleStatsRef.current.healingDone, coinsGain, useGameStore.getState().ownerUserId)
        .catch(err => console.error('Battle sync failed:', err));
      // Keep the server level/xp current even on a loss (a loss still grants XP).
      syncLevelToServer();
    }
  }, [playerHealth, opponentHealth, gameOver, playSound, recordBattleResult, aiDifficulty, clearAllTimeouts, showLevelUp]);

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

  // The hand as last rendered, for playCard's own check below: a handler can
  // outlive the render it was made in (see HandSlot).
  const handRef = useRef(playerHand);
  handRef.current = playerHand;

  // Play a card from hand
  const playCard = (card) => {
    if (currentTurn !== 'player' || phase !== 'main' || gameOver) return;
    if (!handRef.current.some((c) => c.instanceId === card.instanceId)) return;

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

    // Special cards. Playing any card is a change of plan, so it drops an
    // attacker the player had picked but not yet sent (cancelTargeting here
    // and below); a refused play (above, or a full field below) leaves the
    // selection alone.
    if (card.type === 'special') {
      cancelTargeting();
      applySpecialEffect(card);
      setPlayerEnergy(prev => prev - cost);
      setPlayerHand(prev => prev.filter(c => c.instanceId !== card.instanceId));
      setPlayerMomentum(prev => Math.min(MOMENTUM_MAX, prev + 1));
      battleStatsRef.current.cardsPlayed += 1;
      playSound('cardPlay');
      return;
    }

    // Handle action/trap cards
    if (playerField.length >= MAX_FIELD_SIZE) {
      // Nothing removes a teddy by hand, so the copy cannot say "remove one".
      toast({
        title: "Field is full!",
        description: `${MAX_FIELD_SIZE} teddies is the limit. One has to go down before ${card.name} can join.`,
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

    cancelTargeting();
    setPlayerField(prev => [...prev, cardToPlay]);
    setPlayerHand(prev => prev.filter(c => c.instanceId !== card.instanceId));
    setPlayerEnergy(prev => prev - cost);
    setPlayerMomentum(prev => Math.min(MOMENTUM_MAX, prev + 1));
    battleStatsRef.current.cardsPlayed += 1;
    playSound('cardPlay');

    // A card with a rule gets the ability callout, which names the rule it
    // brings; it clears any toast left over from earlier in the turn, which
    // would otherwise stack on it on the table's centre line. A plain card
    // gets nothing more: the card landing on the table is the news, and the
    // log entry below records it (and is what a screen reader hears) — a
    // "Card Played" toast on every play only repeated both.
    if (card.ability && card.ability !== 'none') {
      dismissToasts();
      setShowAbilityPopup({ name: card.name, ability: card.ability });
      safeTimeout(() => setShowAbilityPopup(null), 1500);
    }

    addToBattleLog(`Played ${card.name}${card.ability && card.ability !== 'none' ? ` (${card.ability})` : ''}`);
  };

  // Apply special card effects. What a special did shows on the board — a
  // heal floats its number off your health, a draw lands in the hand, a buff
  // floats over each creature — and the log records it, so none of that gets
  // a toast. A toast is for the case the board cannot show: a legal play
  // that did nothing.
  const applySpecialEffect = (card) => {
    switch (card.effect) {
      case 'heal': {
        // Credit the healing that actually landed, not the card's face value.
        // Healing caps at 30, so playing a +10 heal at 28 HP restores 2 — but
        // the full 10 was being counted toward the 'Medic Bear' achievement and
        // the daily healing challenge, letting both be farmed at full HP.
        const healed = Math.min(PLAYER_MAX_HEALTH, playerHealth + card.amount) - playerHealth;
        setPlayerHealth(prev => Math.min(PLAYER_MAX_HEALTH, prev + card.amount));
        battleStatsRef.current.healingDone += healed;
        playSound('heal');
        if (healed > 0) {
          pushFx([{ face: 'player', tone: 'heal', text: `+${healed}` }]);
          addToBattleLog(`${card.name}: +${healed} HP. No questions asked.`);
        } else {
          // Still a legal play, but not a win to celebrate: it said "Patched
          // Up! +0 HP" once, which is congratulating a wasted card.
          addToBattleLog(`${card.name} did nothing — you were already at full HP.`);
          toast({ title: 'Already fully stuffed', description: `${card.name} did nothing — you were already at full HP.` });
        }
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
        if (cardsToDraw > 0) {
          addToBattleLog(`${card.name}: drew ${cardsToDraw} — the dealer likes you`);
        } else {
          addToBattleLog(`${card.name} drew nothing — your deck is empty.`);
          toast({ title: 'Nothing to draw', description: `${card.name} came up empty — your deck is out of cards.` });
        }
        break;
      }
      case 'buff': {
        // Creatures only: a trap's attack is never shown or used.
        const squad = playerField.filter((c) => c.type === 'action');
        pushFx(squad.map((c) => ({ card: c.instanceId, tone: 'buff', text: `+${card.amount}` })));
        setPlayerField(prev => prev.map(c => ({ ...c, attack: c.attack + card.amount })));
        if (squad.length > 0) {
          addToBattleLog(`Your whole squad is FIRED UP — +${card.amount} attack across the board!`);
        } else {
          addToBattleLog(`${card.name} did nothing — no teddy of yours on the table to pump.`);
          toast({ title: 'Nobody to juice', description: `${card.name} did nothing — you have no teddy on the table.` });
        }
        break;
      }
      default:
        break;
    }
  };

  // Pick an attacker. At any point in the player's turn: there is no separate
  // battle phase, so cards can be played before and after attacking.
  const selectCardForAttack = (card) => {
    if (currentTurn !== 'player' || phase !== 'main' || gameOver) return;
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
    // The outcome is drawn on the table (the lunge, the hit, the number, the
    // crumple) and written to the log, so it gets no toast: a toast for every
    // hit covered the log and the table to repeat them.
    const { survivor, overkill, dmg } = resolveCreatureHit(attacker, target, playerField);
    playSound('attack');
    battleStatsRef.current.damageDealt += dmg;
    // On a kill the card shows what it actually lost, and any trample shows
    // on the face: the two add up to the hit, rather than the hit twice over.
    const taken = survivor ? dmg : dmg - overkill;
    pushFx([
      { card: attacker.instanceId, strike: true },
      ...(taken > 0 ? [{ card: target.instanceId, hit: true, tone: 'damage', text: `−${taken}` }] : []),
      ...(!survivor && overkill > 0 ? [{ face: 'opponent', hit: true, tone: 'damage', text: `−${overkill}` }] : []),
    ]);

    if (survivor) {
      setOpponentField(prev => prev.map(c => c.instanceId === target.instanceId ? survivor : c));
      if (target.ability === 'fury') {
        addToBattleLog(gainedFuryStack(target, survivor)
          ? `${target.name}'s fury activated! +1 attack`
          : `${target.name} is already as furious as they get — capped at +3.`);
      }
      addToBattleLog(`${attacker.name} smacked ${target.name} for ${dmg} (${survivor.currentHp} HP left)`);
    } else {
      setOpponentField(prev => prev.filter(c => c.instanceId !== target.instanceId));
      if (overkill > 0) setOpponentHealth(prev => Math.max(0, prev - overkill));
      addToBattleLog(`UNSTUFFED! ${attacker.name} took ${target.name} apart${overkill > 0 ? ` — ${overkill} trampled right into ${OPPONENT_NAME}'s beans` : ''}`);
      speak('oppLosesCreature');
    }

    // Mark card as having attacked
    setPlayerField(prev => prev.map(c =>
      c.instanceId === selectedCard.instanceId ? { ...c, hasAttacked: true } : c
    ));

    setPlayerMomentum(prev => Math.min(MOMENTUM_MAX, prev + 2));
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
        { card: selectedCard.instanceId, strike: true },
        ...(trapDamage > 0 ? [{ face: 'player', hit: true, tone: 'damage', text: `−${trapDamage}` }] : []),
      ]);
      setPlayerHealth(prev => Math.max(0, prev - trapDamage));
      battleStatsRef.current.damageTaken += trapDamage;
      setOpponentField(prev => prev.filter(c => c.instanceId !== trap.instanceId));
      playSound('trap');
      addToBattleLog(`${trap.name} sprang! ${trapDamage} damage, right in your pride`);
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
        { card: attacker.instanceId, strike: true },
        ...(faceDamage > 0 ? [{ face: 'opponent', hit: true, tone: 'damage', text: `−${faceDamage}` }] : []),
      ]);
      setOpponentHealth(prev => Math.max(0, prev - faceDamage));
      battleStatsRef.current.damageDealt += faceDamage;
      addToBattleLog(`${attacker.name} decked ${OPPONENT_NAME} in the face for ${faceDamage}!`);
      if (faceDamage >= 4) speak('oppTakesFaceHit');
    }

    setPlayerField(prev => prev.map(c =>
      c.instanceId === selectedCard.instanceId ? { ...c, hasAttacked: true } : c
    ));

    setPlayerMomentum(prev => Math.min(MOMENTUM_MAX, prev + 3));
    setSelectedCard(null);
    setTargetingMode(false);
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
    if (currentTurn !== 'player' || gameOver || !canRally({ momentum: playerMomentum, field: playerField })) return;
    // Creatures only, as rallyField: traps are untouched.
    pushFx(playerField.filter((c) => c.type === 'action').map((c) => ({ card: c.instanceId, tone: 'buff', text: '+1' })));
    setPlayerField(prev => rallyField(prev));
    setPlayerMomentum(0);
    playSound('heal');
    celebrate({
      particleCount: 120, spread: 90, origin: { y: 0.7 },
      colors: ['#fbbf24', '#f59e0b', '#f97316', '#fde68a'],
    });
    addToBattleLog('⚡ RALLY! Your teddies scream something unprintable — +1 attack, fully restuffed!');
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
    const { plays, remainingDeck } = chooseOpponentPlays(opponentDeck, opponentField.length, energyBudget, MAX_FIELD_SIZE, activeOpponentField);
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
          const taken = survivor ? dmg : dmg - overkill;
          waveFx.push({ card: card.instanceId, strike: true });
          if (taken > 0) waveFx.push({ card: target.instanceId, hit: true, tone: 'damage', text: `−${taken}` });
          if (!survivor && overkill > 0) waveFx.push({ face: 'player', hit: true, tone: 'damage', text: `−${overkill}` });
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
          waveFx.push({ card: card.instanceId, strike: true });
          if (trapDamage > 0) waveFx.push({ face: 'opponent', hit: true, tone: 'damage', text: `−${trapDamage}` });
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
          waveFx.push({ card: card.instanceId, strike: true });
          if (oppFaceDamage > 0) waveFx.push({ face: 'player', hit: true, tone: 'damage', text: `−${oppFaceDamage}` });
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
        setPlayerEnergy(energyForTurn(turnCount + 1));
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
  // deck) instead of being soft-locked with no damaging play available. Asks
  // first, through the same dialog as "← Menu".
  const concedeGame = () => {
    if (gameOver) return;
    setLeaveMode('concede');
  };

  // The dialog's answer. From "← Menu" the player is leaving: go, and the
  // unmount books the loss (see recordAbandonment). From Concede they stay
  // for the result: the defeat flow records it and shows the result dialog.
  const confirmLeave = () => {
    const mode = leaveMode;
    setLeaveMode(null);
    if (mode === 'leave') {
      onBackToMenuRef.current?.();
      return;
    }
    if (liveRef.current.gameOver) return;
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
    setPlayerHealth(PLAYER_MAX_HEALTH);
    setPlayerEnergy(energyForTurn(1));
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
    setLeaveMode(null);
    setBattleLog([]);
    setFx([]);
    setGameOver(false);
    setWinner(null);
    setShowAbilityPopup(null);
    setBattleRewards(rewardsFrom(null));

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

  const won = winner === 'player';
  const playerTurn = currentTurn === 'player';
  // The player's turn proper: their card has arrived, and they can play cards
  // and attack with ready creatures in any order until they end it.
  const playerMove = playerTurn && phase === 'main' && !gameOver;
  const moveState = {
    hand: playerHand, field: playerField, energy: playerEnergy, health: playerHealth,
    maxHealth: PLAYER_MAX_HEALTH, deckSize: playerDeck.length, momentum: playerMomentum,
  };
  // Nothing left worth doing this turn: End Turn becomes the primary action.
  const outOfMoves = playerMove && !hasMoveLeft(moveState);
  const directTargets = targetingMode && getValidTargets(playerField, opponentField).length === 0;
  const latestLog = battleLog.length > 0 ? battleLog[battleLog.length - 1].message : '';
  // Whoever spoke last, for the centre line below xl (see the bubbles).
  const speech = [oppQuip && { ...oppQuip, who: 'opponent' }, playerQuip && { ...playerQuip, who: 'player' }]
    .filter(Boolean)
    .sort((a, b) => b.seq - a.seq)[0] ?? null;
  const lastPlayerHit = latestHit(fx.filter((e) => e.face === 'player'));

  // Fit the two card rows to the table. The board is a fixed-height column
  // (rails, table, controls, hand), and the height the table actually gets
  // depends on the real viewport — a phone's browser toolbars, the control row
  // wrapping, a short window — which fixed viewport-height breakpoints could
  // not see: on short phones the player's row spilled out of the felt onto
  // the turn controls and took their taps. So measure the felt and scale the
  // rows to what fits (CSS zoom, so the layout scales with them), on resize
  // only. A creature's status chip sits over the card, so a "Warming Up"
  // appearing never rescales the board.
  //
  // The same measurement sizes the card preview (as large as the felt allows,
  // up to twice hand size) and says whether it fits beside the rows, where it
  // covers none of them, or has to sit over the middle of the table.
  const [fieldZoom, setFieldZoom] = useState(1);
  const [previewLayout, setPreviewLayout] = useState({ zoom: 2, side: false });
  const rowSlots = Math.max(1, playerField.length, opponentField.length + (directTargets ? 1 : 0));
  const rowSlotsRef = useRef(rowSlots);
  rowSlotsRef.current = rowSlots;
  const fitField = useCallback(() => {
    const felt = feltRef.current;
    const centre = centreRef.current;
    if (!felt || !centre) return;
    const cs = getComputedStyle(felt);
    const px = (v) => parseFloat(v) || 0;
    const inner = felt.clientHeight - px(cs.paddingTop) - px(cs.paddingBottom);
    const forRows = inner - centre.offsetHeight - 2 * px(cs.rowGap);
    const width = felt.clientWidth - px(cs.paddingLeft) - px(cs.paddingRight);
    const n = rowSlotsRef.current;
    const rowWidth = n * FIELD_SLOT + (n - 1) * FIELD_GAP;
    const fit = Math.min(1, forRows / (2 * FIELD_ROW_HEIGHT), width / rowWidth);
    const zoom = Math.max(0.45, Math.floor(fit * 100) / 100);
    setFieldZoom(zoom);
    // The preview leaves ~80px under the card for its rules caption.
    const previewZoom = Math.max(1.25, Math.min(2, Math.floor(((inner - 80) / 144) * 100) / 100));
    // Beside the rows it may shrink to fit the room there (a tablet's felt
    // has some, not a 2x card's worth), but not below 1.4x: smaller than
    // that, it is better over the table at full size.
    const sideRoom = (width - rowWidth * zoom) / 2 - 24;
    const sideZoom = Math.min(previewZoom, Math.floor((sideRoom / 96) * 100) / 100);
    const side = sideZoom >= 1.4;
    const shown = side ? sideZoom : previewZoom;
    setPreviewLayout((p) => (p.zoom === shown && p.side === side ? p : { zoom: shown, side }));
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

  // Fit the hand to the screen the way the rows are fitted to the felt. At
  // full spacing an opening hand of six is 616px wide: on a 390px phone the
  // fourth card was cut at the edge and the fifth and sixth were off screen,
  // with nothing to say the strip scrolled — and the card just drawn, which
  // joins at the end, was the one you could not see. Now the cards overlap
  // just enough to fit, as every mobile card game's hand does, each keeping
  // a visible strip; only past HAND_MIN_STRIP (a big hand on a 320px phone)
  // does the strip scroll, with its edges faded to say so. Measured in the
  // strip's own zoomed units (the hand steps down with .board-zoom), so a
  // strip's on-screen width is checked against TOUCH_TARGET through the zoom.
  const handScrollerRef = useRef(null);
  const [handFit, setHandFit] = useState({ step: HAND_STEP, overflow: false });
  const handCountRef = useRef(playerHand.length);
  handCountRef.current = playerHand.length;
  const fitHand = useCallback(() => {
    const el = handScrollerRef.current;
    // Not laid out yet (or not at all, as in jsdom): nothing to fit.
    if (!el || !el.clientWidth) return;
    const cs = getComputedStyle(el);
    const px = (v) => parseFloat(v) || 0;
    const scale = parseFloat(cs.zoom) || 1;
    const n = handCountRef.current;
    const edge = Math.max(px(cs.paddingLeft), fanOverhang(n));
    const available = el.clientWidth - 2 * edge;
    const minStrip = Math.max(HAND_MIN_STRIP, Math.ceil(TOUCH_TARGET / scale));
    let step = HAND_STEP;
    if (n > 1 && HAND_CARD + (n - 1) * HAND_STEP > available) {
      step = Math.max(minStrip, Math.floor((available - HAND_CARD) / (n - 1)));
    }
    const overflow = n > 1 && HAND_CARD + (n - 1) * step > available + 0.5;
    setHandFit((f) => (f.step === step && f.overflow === overflow ? f : { step, overflow }));
  }, []);
  useEffect(() => {
    const el = handScrollerRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(() => fitHand());
    observer.observe(el);
    return () => observer.disconnect();
  }, [fitHand]);
  useEffect(() => { fitHand(); }, [playerHand.length, fitHand]);
  // A drawn card joins the end of the hand. When the strip still has to
  // scroll, bring it into view rather than leave the news off screen.
  const prevHandCountRef = useRef(playerHand.length);
  const reducedMotion = useReducedMotionConfig();
  useEffect(() => {
    const grew = playerHand.length > prevHandCountRef.current;
    prevHandCountRef.current = playerHand.length;
    const el = handScrollerRef.current;
    if (!grew || !handFit.overflow || !el) return;
    el.scrollTo?.({ left: el.scrollWidth, behavior: reducedMotion ? 'auto' : 'smooth' });
  }, [playerHand.length, handFit.overflow, reducedMotion]);
  const handOverlap = HAND_STEP - handFit.step;

  // Reading a card: the enlarged preview (CardPreview). `preview` is the card
  // a mouse rests on, the keyboard has focused, or a finger holds down on the
  // table: { id, from: 'hand' | 'player' | 'opponent' }.
  // `raisedId` is the hand card a first tap raised on a touch screen — there
  // the first tap inspects and the second plays, because overlapped cards
  // hide their cost coins and a tap that played at once left no way to read
  // a card before committing it. A mouse click, Enter and Space still play at
  // once, and the control's name is still "Play <name>".
  const [preview, setPreview] = useState(null);
  const [raisedId, setRaisedId] = useState(null);
  const previewTimerRef = useRef(null);
  // The last press: its pointer type and the card it landed on.
  const lastPointerRef = useRef({ type: 'mouse', id: null });
  const longPressRef = useRef({ timer: null, fired: false, x: 0, y: 0 });
  useEffect(() => () => {
    clearTimeout(previewTimerRef.current);
    clearTimeout(longPressRef.current.timer);
  }, []);
  const showPreview = useCallback((p, delay = 0) => {
    clearTimeout(previewTimerRef.current);
    if (delay) previewTimerRef.current = setTimeout(() => setPreview(p), delay);
    else setPreview(p);
  }, []);
  const hidePreview = useCallback((id) => {
    clearTimeout(previewTimerRef.current);
    setPreview((cur) => (cur && (id == null || cur.id === id) ? null : cur));
  }, []);
  // Any tap outside the raised card lowers it (a tap on another hand card
  // then raises that one).
  useEffect(() => {
    if (!raisedId) return undefined;
    const onDown = (e) => {
      if (e.target instanceof Element && e.target.closest(`[data-hand-id="${raisedId}"]`)) return;
      setRaisedId(null);
    };
    document.addEventListener('pointerdown', onDown, true);
    return () => document.removeEventListener('pointerdown', onDown, true);
  }, [raisedId]);
  useEffect(() => {
    if (gameOver) {
      setRaisedId(null);
      setPreview(null);
    }
  }, [gameOver]);

  // The pointer and focus handlers that open a card's preview. `hold` is
  // what holding a finger on the card does: 'preview' (a table card) opens
  // the preview for as long as the finger stays, 'raise' (a hand card) raises
  // the card, as a first tap does, and it stays raised. Either way the click
  // that ends the hold is swallowed, so reading Chuck's card mid-targeting
  // does not also attack it, and reading a hand card never plays it.
  const inspectHandlers = (p, { hold = null } = {}) => {
    const endHold = () => {
      const lp = longPressRef.current;
      clearTimeout(lp.timer);
      lp.timer = null;
      if (lp.fired && hold === 'preview') hidePreview(p.id);
    };
    return {
      onPointerDown: (e) => {
        lastPointerRef.current = { type: e.pointerType, id: p.id };
        const lp = longPressRef.current;
        lp.fired = false;
        if (!hold || e.pointerType !== 'touch') return;
        clearTimeout(lp.timer);
        lp.x = e.clientX;
        lp.y = e.clientY;
        lp.timer = setTimeout(() => {
          lp.timer = null;
          lp.fired = true;
          if (hold === 'raise') {
            hidePreview();
            setRaisedId(p.id);
          } else {
            showPreview(p);
          }
        }, LONG_PRESS_MS);
      },
      onPointerMove: hold ? (e) => {
        const lp = longPressRef.current;
        if (lp.timer && Math.hypot(e.clientX - lp.x, e.clientY - lp.y) > 10) {
          clearTimeout(lp.timer);
          lp.timer = null;
        }
      } : undefined,
      onPointerUp: hold ? endHold : undefined,
      // A cancelled press (the finger scrolled the hand) ends in no click, so
      // nothing may be left saying a finger is down on this card.
      onPointerCancel: () => {
        if (hold) endHold();
        lastPointerRef.current = { type: 'mouse', id: null };
      },
      onClickCapture: hold ? (e) => {
        if (!longPressRef.current.fired) return;
        longPressRef.current.fired = false;
        e.stopPropagation();
        e.preventDefault();
      } : undefined,
      // A held finger opens the phone's own menu (Android's contextmenu) on
      // top of the preview otherwise.
      onContextMenu: (e) => { if (lastPointerRef.current.type === 'touch') e.preventDefault(); },
      onPointerEnter: (e) => { if (e.pointerType === 'mouse') showPreview(p, PREVIEW_HOVER_MS); },
      onPointerLeave: (e) => { if (e.pointerType === 'mouse') hidePreview(p.id); },
      // Keyboard focus only: a click focuses a card too, and the preview
      // would then outstay the mouse.
      onFocus: (e) => {
        let keyboard = false;
        try { keyboard = e.target === e.currentTarget && e.target.matches(':focus-visible'); } catch { /* old engine */ }
        if (keyboard) showPreview(p);
      },
      onBlur: () => hidePreview(p.id),
    };
  };

  // A hand card's press. With a finger, the first tap raises the card (and
  // opens its preview) and only a tap on the raised card plays it. A click
  // counts as a tap only when a finger came down on this same card before
  // it: a screen reader's activation is a click with no press behind it, and
  // must play at once, as Enter does — its user cannot see the raise, and
  // would hear nothing happen. Where the browser says what made the click
  // (Chromium, Firefox and Safari 17 send it as a PointerEvent), it must also
  // say 'touch'. There is no time limit: a slow press is still a finger, and
  // the 1-second window this once had played a card held down to be read.
  const pressHandCard = (card, playable) => (e) => {
    const last = lastPointerRef.current;
    lastPointerRef.current = { type: 'mouse', id: null };
    const clickType = typeof e?.nativeEvent?.pointerType === 'string' ? e.nativeEvent.pointerType : null;
    const touch = e?.type === 'click' && last.type === 'touch' && last.id === card.instanceId
      && (clickType === null || clickType === 'touch');
    if (touch && raisedId !== card.instanceId) {
      hidePreview();
      setRaisedId(card.instanceId);
      return;
    }
    setRaisedId(null);
    if (playable) playCard(card);
  };

  // The card the preview shows, looked up live, so a card that has just been
  // played or has died takes its preview with it.
  const raisedInHand = raisedId != null && playerHand.some((c) => c.instanceId === raisedId);
  const previewTarget = raisedInHand
    ? { id: raisedId, from: 'hand' }
    : preview;
  const previewPool = { hand: playerHand, player: playerField, opponent: opponentField };
  const previewCard = previewTarget
    ? previewPool[previewTarget.from]?.find((c) => c.instanceId === previewTarget.id) ?? null
    : null;
  // Beside the rows on the right where the felt has the room (fitField), so
  // it covers no card; the felt's left corners are where the speech bubbles
  // sit. Over the middle of the table otherwise.
  const previewPlace = previewLayout.side ? 'right' : 'centre';

  return (
    // Exactly the viewport's height on touch screens. With a mouse it never
    // goes below 640px and the page scrolls instead: zooming the browser in
    // shrinks the CSS viewport, and a board fitted to it would answer by
    // making the cards smaller — the opposite of what zooming in asked for.
    // (The height must stay definite either way; the felt's fit is measured
    // from it.)
    <div className="game-surface relative w-full h-[100dvh] [@media(pointer:fine)]:h-[max(100dvh,40rem)] bar-backdrop overflow-hidden">
      <FxContext.Provider value={fx}>
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

      {/* The board's own way out, in the slot Chuck's rail leaves for it
          (pl-28), centred on the rail. The board owns it rather than App so
          that, while a game is live, it can ask before booking the loss.
          Above the rotate-phone card (z-30), so a landscape player can still
          leave. */}
      {onBackToMenu && (
        <button
          type="button"
          onClick={requestLeave}
          className={`btn-glass absolute top-[calc(0.375rem+env(safe-area-inset-top))] sm:top-[calc(0.625rem+env(safe-area-inset-top))] left-4 z-40 inline-flex h-11 items-center rounded-xl px-4 text-sm font-semibold ${FOCUS_OUTLINE}`}
        >
          ← Menu
        </button>
      )}

      {/* Keyed by gameOver: when the game ends with the question still open
          (Chuck's turn plays on behind it), the dialog goes at once instead
          of fading out. A fade would finish after the result dialog had taken
          the focus, and its focus restore would then hand the focus back to
          "← Menu" behind that dialog, where Enter means leave, not Play
          Again. Gone in the same commit, it restores first. */}
      <AnimatePresence key={gameOver ? 'over' : 'live'}>
        {leaveMode && !gameOver && (
          <LeaveBattleDialog
            key="leave"
            mode={leaveMode}
            streak={currentWinStreak}
            onKeepPlaying={() => setLeaveMode(null)}
            onConcede={confirmLeave}
          />
        )}
      </AnimatePresence>

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

              {/* Rewards: what the battle paid, then the level's progress, a
                  level-up and its bonus coins when there is one, and a Battle
                  Pass tier the XP opened. It used to be the two chips alone,
                  while a level-up paid 100 x the new level in coins without a
                  word. */}
              <div className="relative mb-5">
                <div className="label-caps text-plush-300 mb-2">Battle Rewards</div>
                <div className="flex justify-center gap-3">
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: REWARD_BEATS.xp }}
                    className="panel-glass rounded-xl px-4 py-2.5 flex items-center gap-2"
                  >
                    <Star className="h-5 w-5 text-brass-300" fill="currentColor" aria-hidden="true" />
                    <span className="font-display text-lg font-extrabold text-white tabular-nums">
                      +<CountUp value={battleRewards.xp} delay={REWARD_BEATS.xp * 1000} /><span aria-hidden="true"> XP</span>
                      <span className="sr-only">{battleRewards.xp} XP</span>
                    </span>
                  </motion.div>
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: REWARD_BEATS.coins }}
                    className="panel-glass rounded-xl px-4 py-2.5 flex items-center gap-2"
                  >
                    <Coins className="h-5 w-5 text-brass-300" aria-hidden="true" />
                    <span className="font-display text-lg font-extrabold text-white tabular-nums">
                      +<CountUp value={battleRewards.coins} delay={REWARD_BEATS.coins * 1000} />
                    </span>
                    <span className="sr-only">{battleRewards.coins} coins</span>
                  </motion.div>
                </div>
                {battleRewards.progress && <XpBar progress={battleRewards.progress} />}
                {battleRewards.progress?.levelsGained > 0 && (
                  <LevelUpRow level={battleRewards.progress.levelAfter} bonusCoins={battleRewards.progress.bonusCoins} />
                )}
                {battleRewards.tierAfter > battleRewards.tierBefore && (
                  <motion.p
                    data-pass-tier=""
                    initial={reducedMotion ? false : { opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: REWARD_BEATS.levelUp + 0.3 }}
                    className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-brass-200"
                  >
                    <Crown className="h-4 w-4 text-brass-300" aria-hidden="true" />
                    Battle Pass tier {battleRewards.tierAfter} unlocked
                  </motion.p>
                )}
              </div>

              {/* Upsell nudge — only shown when player is low on resources */}
              {(cardPacks === 0 || gems < 50) && (onOpenShop || onBackToMenu) && (
                <motion.div
                  initial={reducedMotion ? false : { opacity: 0, y: 10 }}
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
                    className={`btn-glass rounded-lg px-4 h-11 text-sm font-bold ${FOCUS_OUTLINE}`}
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
        {/* Opponent's rail. pl-28 leaves room for the "← Menu" control; the
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
            side="opponent"
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
                  so this is hidden from assistive tech. From xl up only: the
                  rows are centred, and narrower than that a full row reaches
                  the corner (measured: at 1024px a three-card row starts at
                  x=261 and a full bubble ends at 263; at 390 the bubble hid
                  his opener's name and cost at every deal). Below xl the line
                  goes on the centre line instead, which never covers a card. */}
              <AnimatePresence>
                {oppQuip && (
                  <motion.div
                    key={oppQuip.id}
                    data-speech="opponent"
                    aria-hidden="true"
                    initial={{ opacity: 0, y: -8, scale: 0.9 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    transition={{ type: 'spring', stiffness: 350, damping: 22 }}
                    className="absolute top-3 left-3 z-20 max-w-[220px] pointer-events-none hidden xl:block"
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
                {/* Keyed by game: Play Again remounts the row, rather than
                    playing the last game's cards out as if they had died. */}
                <AnimatePresence key={gameId}>
                {opponentField.map((card) => {
                  const validTargets = getValidTargets(playerField, opponentField);
                  const isValidTarget = validTargets.find(t => t.instanceId === card.instanceId);
                  const hittable = targetingMode && isValidTarget;

                  return (
                    <FieldSlot
                      key={card.instanceId}
                      cardId={card.instanceId}
                      side="opponent"
                      initial={{ y: -40, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      data-field="opponent"
                      className={`relative rounded-[10px] ${FOCUS_OUTLINE} ${hittable ? 'cursor-crosshair' : ''}`}
                      press={pressable(() => attackTarget(card), `Attack ${card.name}`, targetingMode)}
                      {...inspectHandlers({ id: card.instanceId, from: 'opponent' }, { hold: 'preview' })}
                    >
                      <div
                        data-target-ring={hittable ? '' : undefined}
                        className={`relative rounded-[10px] transition-shadow ${hittable ? 'ring-2 ring-red-400 shadow-[0_0_22px_4px_rgba(248,113,113,0.55)]' : ''}`}
                      >
                        {/* Only the card dims for stealth; the band and tags
                            stay at full strength so they keep their contrast. */}
                        <div className={card.stealthActive ? 'opacity-50' : ''}>
                          <TeddyCard teddy={card} lift={false} variant="board" side="opponent" tauntActive={card.ability === 'taunt' && !card.stealthActive} />
                        </div>
                        {card.stealthActive && <StealthBand />}
                        {/* Tells the player which of Chuck's teddies can
                            actually swing at them next turn — without it,
                            summoning sickness is only legible on their own
                            half of the table. */}
                        {card.summoningSick && <StatusChip>Warming Up</StatusChip>}
                        {hittable && (
                          <span data-target-mark="" className="absolute -top-2.5 -right-2.5 z-20 grid h-7 w-7 place-items-center rounded-full bg-red-600 ring-2 ring-red-200 shadow-lg" aria-hidden="true">
                            <Crosshair className="h-4 w-4 text-white" />
                          </span>
                        )}
                      </div>
                    </FieldSlot>
                  );
                })}
                </AnimatePresence>
                {directTargets && (
                  <motion.div
                    whileHover={{ scale: 1.04 }}
                    whileFocus={{ scale: 1.04 }}
                    className={`w-24 h-36 rounded-[10px] border-2 border-dashed border-red-400/80 bg-red-950/50 shadow-[0_0_22px_rgba(248,113,113,0.35)] flex flex-col items-center justify-center gap-2 cursor-crosshair ${FOCUS_OUTLINE}`}
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
                  that is always reserved — the targeting prompt; else, below
                  xl, the last thing said (Chuck's quip or your emote); else,
                  below md, the latest event — so nothing appearing there
                  moves the rows. */}
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
                      ? <>You<span className="hidden min-[360px]:inline">r move</span></>
                      : <>{OPPONENT_NAME}<span className="hidden min-[360px]:inline">&apos;s turn</span></>}
                  </div>
                  <span className="h-px flex-1 bg-gradient-to-l from-transparent to-brass-300/45" aria-hidden="true" />
                  <span className="hidden lg:block w-32 shrink-0" aria-hidden="true" />
                </div>

                {/* Two lines tall below xl, where Chuck's lines show here:
                    they run to 63 characters, and one line at 390px holds
                    about 42, which cut most of them before the punchline. */}
                <div className="flex min-h-8 xl:min-h-[1.5rem] max-w-full items-center justify-center">
                  {targetingMode ? (
                    <div className="relative flex items-center gap-1.5 rounded-full bg-red-950/90 px-3 py-1 text-xs font-bold text-red-100">
                      {/* The ring pulses, not the text, so the prompt keeps its
                          contrast at every point of the pulse. */}
                      <span className="absolute inset-0 rounded-full ring-1 ring-red-400/70 motion-safe:animate-pulse" aria-hidden="true" />
                      <Crosshair className="h-3.5 w-3.5" aria-hidden="true" />
                      Pick a victim for {selectedCard?.name}!
                    </div>
                  ) : speech ? (
                    /* Up to two lines (every line in the pools fits two at
                       320px), and the whole line is in the log as well. Keyed
                       so each new line fades in. Framer Motion owns this
                       element's transform, so it carries no transform class. */
                    <motion.div
                      key={`${speech.who}-${speech.id}`}
                      aria-hidden="true"
                      data-speech={speech.who}
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.2 }}
                      className={`xl:hidden max-w-full line-clamp-2 break-words rounded-2xl px-3 py-0.5 text-center text-xs leading-[14px] font-semibold text-night-900 pointer-events-none ${speech.who === 'opponent'
                        ? 'bg-plush-100 ring-1 ring-red-300/70'
                        : 'bg-brass-200 ring-1 ring-brass-400/70'}`}
                    >
                      <span className="mr-1">{speech.who === 'opponent' ? '🧸' : '🎭'}</span>
                      {speech.text}
                    </motion.div>
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
                <AnimatePresence key={gameId}>
                {playerField.map((card) => {
                  const selected = selectedCard?.instanceId === card.instanceId;
                  // A ready creature is an attacker the player can pick at
                  // any point in their turn; nothing else on their side is.
                  const ready = playerMove && canAttack(card);
                  const resting = card.type === 'action' && !canAttack(card);
                  return (
                    <FieldSlot
                      key={card.instanceId}
                      cardId={card.instanceId}
                      side="player"
                      initial={{ y: 30, opacity: 0, scale: 0.88 }}
                      animate={{ y: 0, opacity: 1, scale: 1 }}
                      transition={{ type: 'spring', stiffness: 380, damping: 26 }}
                      whileHover={ready ? { y: -5 } : undefined}
                      whileFocus={ready ? { y: -5 } : undefined}
                      className={`relative rounded-[10px] ${FOCUS_OUTLINE} ${ready ? 'cursor-pointer' : ''}`}
                      /* Only a ready creature is a button: a warming-up or
                         spent one, or a trap, would be a "Select … to attack"
                         that cannot attack, and its chip ("Warming Up",
                         "Exhausted") already says why. A tap on one still
                         reaches selectCardForAttack, which owns the rejection
                         messages, so a pointer player who tries is told the
                         rule rather than met with silence. */
                      press={ready
                        ? pressable(() => selectCardForAttack(card), `Select ${card.name} to attack`)
                        : (playerMove ? { onClick: () => selectCardForAttack(card) } : {})}
                      data-field="player"
                      {...inspectHandlers({ id: card.instanceId, from: 'player' }, { hold: 'preview' })}
                    >
                      <div
                        data-target-ring={selected || ready ? '' : undefined}
                        className={`relative rounded-[10px] transition-shadow ${selected
                          ? 'ring-2 ring-brass-300 shadow-[0_0_24px_4px_rgba(251,191,36,0.55)]'
                          : ready ? 'shadow-[0_0_18px_2px_rgba(52,211,153,0.5)]' : ''}`}
                      >
                        <div className={resting ? 'opacity-60' : ''}>
                          <TeddyCard teddy={card} cosmeticBorder={cosmeticBorder} lift={false} variant="board" side="player" tauntActive={card.ability === 'taunt' && !card.stealthActive} />
                        </div>
                        {card.stealthActive && <StealthBand />}
                        {card.hasAttacked && <StatusChip>Exhausted</StatusChip>}
                        {card.summoningSick && !card.hasAttacked && <StatusChip>Warming Up</StatusChip>}
                      </div>
                    </FieldSlot>
                  );
                })}
                </AnimatePresence>
              </div>

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
                  felt's corner on their side — same decorative treatment, and
                  the same xl threshold, as Chuck's; the battle log carries the
                  accessible record. */}
              <AnimatePresence>
                {playerQuip && (
                  <motion.div
                    key={playerQuip.id}
                    data-speech="player"
                    aria-hidden="true"
                    initial={{ opacity: 0, y: 8, scale: 0.9 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    transition={{ type: 'spring', stiffness: 350, damping: 22 }}
                    className="absolute bottom-3 left-3 z-20 max-w-[220px] pointer-events-none hidden xl:block"
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
                      <div className="text-sm text-plush-200">{abilityRules(showAbilityPopup.ability)}</div>
                    </motion.div>
                  </div>
                )}
              </AnimatePresence>

              {/* The card being read, at full size (see CardPreview). */}
              {previewCard && !gameOver && (
                <CardPreview
                  card={previewCard}
                  place={previewPlace}
                  zoom={previewLayout.zoom}
                  costDelta={previewTarget.from === 'hand' ? effectiveCost(previewCard, playerField) - previewCard.cost : 0}
                  cosmeticBorder={previewTarget.from === 'opponent' ? null : cosmeticBorder}
                />
              )}
            </div>
          </div>

          {/* Beside the table from md up; rows under it on phones. */}
          <div className="shrink-0 flex flex-col gap-2 md:gap-3 md:w-56 md:pb-1">
            {/* The room an open toast docks into from md up (see toastRoom). */}
            {toastRoom > 0 && (
              <div aria-hidden="true" data-toast-room="" className="hidden md:block shrink-0" style={{ height: toastRoom }} />
            )}
            {/* Battle log — a panel from md up; phones get the ticker on the
                centre line instead, since a panel there would cover cards.
                tabIndex + role/aria-label make the scrolling panel keyboard-
                reachable (axe: scrollable-region-focusable), and the region
                itself is the scroller, which axe requires. It has no aria-live
                of its own; the sr-only log on the table is the one announcer.
                Newest first, so the entry that just happened is in view, and
                set apart as the log's headline. */}
            <div
              role="region"
              aria-label="Battle log"
              tabIndex={0}
              className={`hidden md:block flex-1 min-h-0 overflow-y-auto panel-glass rounded-xl p-3 ${FOCUS_OUTLINE}`}
            >
              <div className="flex items-center gap-1.5 mb-2 text-brass-300">
                <ScrollText className="h-3.5 w-3.5" aria-hidden="true" />
                <span className="label-caps">Battle Log</span>
              </div>
              {[...battleLog].reverse().map((entry, i) => (
                <div
                  key={entry.id}
                  data-newest={i === 0 ? '' : undefined}
                  className={`text-xs leading-snug py-1.5 border-b border-white/[0.06] last:border-0 ${i === 0
                    ? '-mx-1.5 mb-1 rounded-md border-l-2 border-l-brass-300 bg-white/[0.06] pl-2 pr-1.5 font-semibold text-plush-100'
                    : 'text-plush-300'}`}
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
                    className={`btn-glass flex-none grid place-items-center h-11 w-11 rounded-xl text-lg ${FOCUS_OUTLINE}`}
                  >
                    {emote.icon}
                  </button>
                ))}
              </div>
            )}

            {/* Game controls. The line keeps its height on Chuck's turn, when
                the buttons are gone: below md the table's height depends on
                it, and an empty line made the whole table grow and shrink at
                every turn boundary. Concede is icon-only on phones, to keep
                the line short enough not to wrap. */}
            <div className="flex min-h-11 flex-row flex-wrap items-center justify-center gap-2 md:flex-col md:items-stretch">
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
              {/* Only with a teddy to rally (canRally): with none, a full
                  gauge would buy nothing, and a brass Rally sat beside the
                  brass End Turn that no-moves-left lights. */}
              {!gameOver && playerTurn && canRally(moveState) && (
                <button type="button" className={`${ACTION} btn-brass foil relative`} onClick={rally}>
                  {/* Above the foil band (::after), which would otherwise
                      sweep across the label and wash it out. */}
                  <span className="relative z-10 inline-flex items-center gap-1.5">
                    <Zap className="h-4 w-4" fill="currentColor" aria-hidden="true" />
                    Rally!
                  </span>
                </button>
              )}
              {/* The one turn control. Glass while the player still has a
                  move (a ready attacker, a card worth playing, a Rally),
                  brass once they have none, like Hearthstone's End Turn. */}
              {playerMove && (
                <button
                  type="button"
                  className={`${ACTION} ${outOfMoves ? 'btn-brass end-turn-ready' : 'btn-glass'}`}
                  data-out-of-moves={outOfMoves ? '' : undefined}
                  onClick={endTurn}
                >
                  End Turn
                </button>
              )}
              {!gameOver && playerTurn && (
                <button
                  type="button"
                  title="Concede"
                  className={`${ACTION} btn-glass min-w-11 !px-3 sm:!px-4 text-plush-300 hover:text-white text-xs md:mt-1`}
                  onClick={concedeGame}
                >
                  <Flag className="h-3.5 w-3.5" aria-hidden="true" />
                  <span className="sr-only sm:not-sr-only">Concede</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Player's hand. The cards overlap to fit the screen (see fitHand),
            and the strip only scrolls once they cannot overlap any further,
            with its edges faded then to say there is more. The cards sit in a
            w-max mx-auto strip rather than using justify-center on the
            scroller: centred overflow spills to both sides and the left side
            cannot be scrolled to, which hid the first cards of a big hand.
            The padding is the room a hovered or raised card lifts into and
            the fan's outer corners swing into; overflow-y is hidden so the
            lift never summons a vertical scrollbar. Later cards lie over
            earlier ones (zIndex), so every card keeps its left strip — and
            its name — in view. */}
        <div
          ref={handScrollerRef}
          data-hand-overflow={handFit.overflow ? '' : undefined}
          className={`board-zoom shrink-0 max-w-full overflow-x-auto overflow-y-hidden px-3 sm:px-6 pt-11 pb-6 ${handFit.overflow
            ? '[mask-image:linear-gradient(90deg,transparent,#000_16px,#000_calc(100%-16px),transparent)]'
            : ''}`}
        >
          <div className="mx-auto flex w-max gap-2">
            <AnimatePresence>
              {playerHand.map((card, index) => {
                const mid = (playerHand.length - 1) / 2;
                const step = fanStep(playerHand.length);
                // One figure for the coin, the dimming and playCard's own
                // check (Swarm's discount), so the three always agree.
                const cost = effectiveCost(card, playerField);
                const affordable = playerEnergy >= cost;
                const playable = playerMove;
                // The glow marks a card worth playing now; a legal play that
                // would do nothing (a heal at full HP) stays bright but unlit.
                const lit = playable && isUsefulPlay(card, moveState);
                const raised = raisedId === card.instanceId;
                return (
                  <HandSlot
                    key={card.instanceId}
                    data-hand-id={card.instanceId}
                    data-raised={raised ? '' : undefined}
                    initial={{ y: 50, opacity: 0 }}
                    animate={raised
                      ? { y: -24, scale: 1.08, opacity: 1, rotate: 0, zIndex: 20 }
                      : { y: Math.abs(index - mid) * step, scale: 1, opacity: 1, rotate: (index - mid) * step, zIndex: index }}
                    exit={{ y: 50, opacity: 0 }}
                    whileHover={{ y: -20, scale: 1.08, zIndex: 10 }}
                    // The same lift for the keyboard (Framer Motion's focus
                    // gesture follows :focus-visible and adds no tab stop),
                    // and a brass outline rather than the browser's default
                    // ring, which read as a stray line on the dark board.
                    whileFocus={{ y: -20, scale: 1.08, zIndex: 10 }}
                    // The overlap is a margin, not a transform: Framer Motion
                    // owns this element's transform (the fan and the lift).
                    style={{ transformOrigin: 'bottom center', marginLeft: index ? -handOverlap : 0 }}
                    className={`relative shrink-0 rounded-[10px] ${FOCUS_OUTLINE} ${playable ? 'cursor-pointer' : ''} ${!affordable
                      ? 'opacity-50 saturate-50'
                      : lit ? 'shadow-[0_0_16px_1px_rgba(251,191,36,0.4)]' : ''}`}
                    {...inspectHandlers({ id: card.instanceId, from: 'hand' }, { hold: 'raise' })}
                    press={playable
                      ? pressable(pressHandCard(card, true), `Play ${card.name}`)
                      : { onClick: pressHandCard(card, false) }}
                  >
                    <TeddyCard teddy={card} cosmeticBorder={cosmeticBorder} lift={false} costDelta={cost - card.cost} />
                    {raised && playable && (
                      <RaisedHint>{affordable ? 'Tap again to play' : `Needs ${cost} energy`}</RaisedHint>
                    )}
                  </HandSlot>
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
              {/* Words from sm up; below it an icon and a number each, since
                  "Deck: 4 | Hand: 5" did not fit a 320px rail and ran under
                  the sound button. The words a screen reader hears follow
                  what is shown. */}
              <div data-rail-counts="" className="flex items-center gap-2 overflow-hidden whitespace-nowrap text-[11px] text-emerald-200/80">
                <span className="inline-flex items-center gap-0.5">
                  <span className="hidden sm:inline">Deck: </span>
                  <Layers className="h-3 w-3 sm:hidden" aria-hidden="true" />
                  {playerDeck.length}
                  <span className="sr-only sm:hidden"> in deck</span>
                </span>
                <span className="hidden sm:inline" aria-hidden="true">|</span>
                <span className="inline-flex items-center gap-0.5">
                  <span className="hidden sm:inline">Hand: </span>
                  <Hand className="h-3 w-3 sm:hidden" aria-hidden="true" />
                  {playerHand.length}
                  <span className="sr-only sm:hidden"> in hand</span>
                </span>
              </div>
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
            {/* The sound switch, here because the only other one is in
                Settings, and getting there means leaving the battle. It
                used to be a picture of a speaker that looked like this
                button and did nothing. 44px to tap around a 28-32px chip:
                the negative margin spends the extra on the gaps either side
                (gap-2), so the rail's layout does not move. No material on
                the button itself, so FOCUS_RING. */}
            <button
              type="button"
              onClick={() => setSoundEnabled(!storeSoundEnabled)}
              aria-pressed={storeSoundEnabled}
              aria-label="Sound effects"
              title={storeSoundEnabled ? 'Mute sound effects' : 'Turn sound effects on'}
              className={`group -mx-2 grid h-11 w-11 shrink-0 place-items-center rounded-full ${FOCUS_RING}`}
            >
              <span className="grid h-7 w-7 sm:h-8 sm:w-8 place-items-center rounded-full bg-black/30 ring-1 ring-white/10 text-plush-300 transition-colors group-hover:text-white group-hover:ring-brass-300/40">
                {storeSoundEnabled
                  ? <Volume2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" aria-hidden="true" />
                  : <VolumeX className="h-3.5 w-3.5 sm:h-4 sm:w-4" aria-hidden="true" />}
              </span>
            </button>
            <div className="flex items-center gap-1.5">
              <span
                className="grid h-7 w-7 place-items-center rounded-full shadow-[inset_0_1px_0_rgba(255,255,255,0.6),0_3px_8px_-3px_rgba(0,0,0,0.8)]"
                style={{ background: PLAQUE_BRASS }}
                aria-hidden="true"
              >
                <Zap className="h-4 w-4 text-night-950" fill="currentColor" />
              </span>
              {/* Current over the turn's maximum, as Hearthstone's crystals
                  read: "2/4" says both what is left and what the turn gave. */}
              <span className="font-display text-xl font-extrabold text-white tabular-nums" aria-hidden="true" data-energy="">
                {playerEnergy}<span className="text-sm font-bold text-plush-300">/{energyForTurn(turnCount)}</span>
              </span>
              <span className="sr-only">{playerEnergy} of {energyForTurn(turnCount)} energy</span>
            </div>
            <HealthMeter
              hp={playerHealth}
              max={PLAYER_MAX_HEALTH}
              side="player"
              fill="[&>div]:bg-gradient-to-r [&>div]:from-emerald-600 [&>div]:to-emerald-300"
              label={`Your health: ${playerHealth} of ${PLAYER_MAX_HEALTH}`}
            />
          </div>
        </div>
      </div>
      </FxContext.Provider>
    </div>
  );
});

export default GameBoard;
