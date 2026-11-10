import { useState, useEffect, useCallback, useRef, createContext, useContext, forwardRef, useImperativeHandle } from 'react';
import {
  Crosshair, Flag, Ghost, Hand, Heart, HeartCrack, Layers, ScrollText, Smartphone, Trophy, Volume2, VolumeX, Zap,
} from 'lucide-react';
import TeddyCard, { CardBack, legibleSize } from '../TeddyCard';
import { Progress } from "@/components/ui/progress";
import { RARITY_METAL } from '@/lib/rarity';
import { useToast } from "@/components/ui/use-toast";
import { motion, AnimatePresence, useIsPresent, useReducedMotionConfig } from 'framer-motion';
import { playSound as playSoundEffect } from '@/utils/sounds';
import { useGameStore, ALL_CARDS } from '../../stores/gameStore';
import { celebrate } from '@/lib/celebrate';
import { resolveCreatureHit, rallyField, effectiveCost, effectiveAttack, canAttack, canSwingFace, readyCreatures, gainedFuryStack, getValidTargets, describeBlockedTarget, attackAuraNote, pickBlackoutTarget, stampSwing } from '../../utils/battleUtils';
import { applyInterest, commitBarSpecial, energyAfterCut, payTab, pourExtra, tabTip } from '@/lib/barService';
import { resolveArrival } from '@/lib/arrivals';
import { pickQuip, startPoolFor, OPPONENT_NAME } from '../../utils/teddyTalk';
import { pickResultCopy, RESULT_TITLES, RESULT_SUBLINES } from '../../utils/resultLines';
import { LAST_CALL_BANNER, lastCallLog, BOARD_LINES, fillLine, pickLine } from '@/lib/houseLines';
import { noteBooth } from '@/lib/boothAi';
import { FIRST_FIGHT, firstFightStep } from '@/lib/firstFight';
import { fatigueForEmptyDraw, fatigueLine } from '@/lib/fatigue';
import { applyMulligan, mulliganKeptLine, mulliganOpponentDeck, mulliganOpponentLine, mulliganSwapLine } from '@/lib/mulligan';
import { anchorCoachTarget } from '@/lib/coachAnchor';
import { shouldFatigue } from '@/lib/dailyFight';
import { syncBattleResult, syncPlayerLevel } from '../../utils/supabaseClient';
import { OPPONENT_ENERGY_BY_DIFFICULTY } from '../../utils/opponentAI';
import { planOpponentPlays, planAttackTarget, orderAttackers, mindLine } from '../../utils/opponentMind';
import { strikePrompt } from '@/lib/combatPreview';
import { classifyHit, withImpact, pulseImpact, motionReduced, strongestShake } from '@/lib/combatJuice';
import { hitAside, hitFlavor } from '@/lib/critTalk';
import { emptySlip, notePlay, noteHit, noteHeal, slipLine } from '@/lib/turnSlip';
import './combatFeel.css';
import { buildOpponentDeck, OPPONENT_HEALTH_MOD_BY_DIFFICULTY } from '../../utils/opponentDeck';
import { TAUNTS, tauntLine } from '@/lib/social/taunts';
import { pressable } from '@/lib/a11y';
import { useDialog } from '@/hooks/useDialog';
import { bestOwnedBorder, ownedEmotes, cosmeticLong } from '@/lib/cosmetics';
import { abilityRules, arrivalChip, describeCard } from '@/lib/abilities';
import { MAX_HAND_SIZE, MAX_FIELD_SIZE, MOMENTUM_MAX, MAX_ENERGY, canRally, energyForTurn, hasMoveLeft, isUsefulPlay } from './turn';
import { BOSS_CARD, BOSS_HEAL, STANDARD_RULE, bossMends, readHouseRule } from '@/lib/houseRules';
import { COMBO_PLAY, COMBO_SWING } from '@/lib/comboTalk';
import { crewTaunt } from '@/lib/crewVoice';
import { pickMvp, pushRecap, tallyMvp } from '@/lib/matchNight';
import NightSlip from '../NightSlip';
import { beginHouseTape, compileTape, noteHouse, takeHouseTape } from '@/lib/replay/houseTape';
import { openReplay, saveReplay } from '@/lib/replay/client';
import FlavorLine from '../FlavorLine';
import LeaveBattleDialog from './LeaveBattleDialog';
import BarTab, { REWARD_BEATS } from './BarTab';
import { battlePassTier } from './battlePassTiers';
import { placePreview, CARD_W, CAPTION_W, CAPTION_ROW_W } from './previewPlacement';
import { lastCallDue, nearDeathDue } from './lastCall';
import { FOCUS_OUTLINE, FOCUS_RING } from '@/lib/focus';
import { SCRIM_PAD } from '@/lib/safeArea';

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

// How long the banner across the felt (a turn's, or last call's) stays up: the
// length of the .fx-banner animation in index.css.
const BANNER_MS = 1300;

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
      scale: [1, 1.06, 0.45, 0.45],
      rotate: [0, -2, side === 'player' ? 16 : -16, side === 'player' ? 16 : -16],
      y: [0, 0, side === 'player' ? 40 : -40, side === 'player' ? 40 : -40],
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
    className={`fx-float font-display text-[26px] font-extrabold leading-none tabular-nums ${fx.crit ? 'fx-crit' : ''} ${FX_TONE[fx.tone] ?? FX_TONE.damage} ${className}`}
    style={{ '--fx-i': fx.stack ?? 0, ...(fx.crit ? { color: '#fde68a' } : {}) }}
  >
    {fx.text}
    {fx.flavor ? <span className="fx-flavor">{fx.flavor}</span> : null}
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
            animate={{ scale: 1, color: '#f7f1e8' }}
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
      data-card-id={cardId}
      exit={exitFor(side, reduced)}
      className={cls}
      {...(present ? press : { inert: '', 'aria-hidden': true, 'data-exiting': '' })}
    >
      <div className={`relative ${shakeClass(hit)} ${strike ? (side === 'player' ? 'fx-strike-up' : 'fx-strike-down') : ''}`}>
        {children}
        {hit && <span key={hit.id} className={`fx-flash${hit.crit ? ' fx-crit-flash' : ''}`} aria-hidden="true" />}
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
// long a finger holds a card for the same. The hover delay keeps the preview
// from flashing up under every card the pointer crosses on its way to a
// play. The grace is how long the preview waits, once the mouse leaves the
// card, for the pointer to arrive on it.
const PREVIEW_HOVER_MS = 350;
const PREVIEW_HOVER_GRACE_MS = 300;
const LONG_PRESS_MS = 450;

// A key, drawn as a key cap (a bare capital I in a pill read as a bar).
const Kbd = ({ children }) => (
  <kbd className="mr-1 inline-grid h-4 min-w-[1.25rem] place-items-center rounded-[4px] bg-white/10 px-1 font-sans text-[10px] font-bold text-plush-100 ring-1 ring-inset ring-white/20 shadow-[0_1px_0_rgba(255,255,255,0.15)]">
    {children}
  </kbd>
);

/**
 * A card at full size, for reading it. Board cards are scaled to fit the felt
 * (to 0.64 on a 320px phone) and hand cards overlap, so neither can always be
 * read where it lies. Opened by hovering a card with a mouse, focusing it from
 * the keyboard or pressing I (which reaches every card, tab stop or not),
 * holding a card down, or the first tap on a hand card on a touch screen.
 * Escape closes it. Drawn at the hand layout (cost, rarity, rules line), with
 * the ability's rules text beside or beneath it, and — opened from the
 * keyboard — the keys that drive it.
 *
 * `placement` (previewPlacement.js) is the box on the felt to centre it in,
 * clear of the row it was opened from, and the zoom and layout that fit. Its
 * caption holds the ability's rules, the card's flavor line (`flavor`: the
 * best joke on the card, which the table has no room for) and, when a
 * keyboard opened it, the keys that drive it; the placement says whether the
 * flavor fit, and the caller hands it down only if it did.
 *
 * Decorative — aria-hidden — because what it shows a screen reader already
 * has: the card in words (CardWords, in every card's slot; the flavor line is
 * a joke, not a rule) and the battle log. Transparent to the pointer except
 * when a mouse opened it: then the pointer can move onto it without it
 * closing (`onKeep`), and leaving it or clicking it closes it (`onDismiss`).
 */
const CardPreview = ({
  card, placement, rules, flavor = '', keys, hoverable, onKeep, onDismiss, costDelta = 0, attackDelta = 0, raisedNote = 'a Royal ally', cosmeticBorder = null,
}) => {
  const { place, x, y, w, h, zoom, layout } = placement;
  const beside = layout === 'row';
  return (
    <div
      aria-hidden="true"
      data-card-preview={place}
      className="pointer-events-none absolute z-40 flex items-center justify-center"
      style={{ left: x, top: y, width: w, height: h }}
    >
      <div
        className={`flex items-center gap-2 ${beside ? 'flex-row' : 'flex-col'} ${hoverable ? 'pointer-events-auto' : ''}`}
        onPointerEnter={hoverable ? onKeep : undefined}
        onPointerLeave={hoverable ? onDismiss : undefined}
        onClick={hoverable ? onDismiss : undefined}
      >
        <div className="rounded-[10px] shadow-[0_24px_48px_-12px_rgba(0,0,0,0.9)]" style={{ zoom }}>
          <TeddyCard teddy={card} lift={false} cosmeticBorder={cosmeticBorder} costDelta={costDelta} attackDelta={attackDelta} raisedNote={raisedNote} artVariant="responsive" artLoading="eager" />
        </div>
        {(rules || flavor || keys) && (
          <div
            className="rounded-lg bg-night-950/95 px-3 py-2 text-center ring-1 ring-white/10 shadow-[0_10px_24px_-8px_rgba(0,0,0,0.8)]"
            style={{ width: beside ? CAPTION_ROW_W : Math.max(CAPTION_W, Math.round(CARD_W * zoom)) }}
          >
            {rules && (
              <>
                <div className="label-caps text-brass-300">{card.ability}</div>
                <div className="mt-0.5 text-xs leading-snug text-plush-100">{rules}</div>
              </>
            )}
            {/* The flavor line, under the rules (or alone, for a card with
                none), drawn by FlavorLine like every other screen's: the
                caption only sets it smaller and italic (the ! utilities beat
                FLAVOR_LINE's own size and leading), the 11px / 15px that
                captionHeight counts the room by. The placement counted it
                with quotation marks round it, which FlavorLine does not
                add, so it can only take less room than reserved. */}
            {flavor && (
              <FlavorLine
                card={card}
                data-preview-flavor=""
                className={`!text-[11px] !leading-[15px] italic ${rules ? 'mt-1.5 border-t border-white/10 pt-1.5' : ''}`}
              />
            )}
            {/* Each key with its action, unbroken; the pairs wrap onto two
                lines in the narrow caption beside the card. */}
            {keys && (
              <div
                data-preview-keys=""
                className={`flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-[11px] leading-4 text-plush-300 ${rules || flavor ? 'mt-1.5 border-t border-white/10 pt-1.5' : ''}`}
              >
                <span className="whitespace-nowrap"><Kbd>I</Kbd> next card</span>
                <span className="whitespace-nowrap"><Kbd>Esc</Kbd> close</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

// What a raised hand card says it will do on a second tap (touch screens,
// where the first tap only raises it). Not a control: the card is. It sits
// 10px over the card's top edge: with the raise (20px up, 1.08x from the
// bottom edge) that keeps it inside the hand's 44px top padding, where the
// strip's overflow would otherwise cut off the top of the words.
const RaisedHint = ({ children }) => (
  <span
    aria-hidden="true"
    className="pointer-events-none absolute -top-2.5 left-1/2 z-20 -translate-x-1/2 whitespace-nowrap rounded-full bg-night-950/95 px-2 py-0.5 text-[10px] font-bold leading-[14px] text-brass-200 ring-1 ring-brass-300/60 shadow-[0_4px_10px_-2px_rgba(0,0,0,0.8)]"
  >
    {children}
  </span>
);

// "Warming Up" / "Exhausted", across the lower part of the card, above its
// stats — over the art rather than in a slot reserved below it. Outside the
// card's own dimming, so it keeps its contrast on a resting card. Hidden from
// a screen reader, which hears the state in the card's words (CardWords); the
// e2e suite counts these chips by their exact text, since those words say it
// too, in a longer line. `zoom` is the row's: the words grow to stay at 8px
// on screen (legibleSize), onto two lines where one no longer fits.
const StatusChip = ({ children, zoom = 1, marked = false }) => {
  const size = legibleSize(10, zoom);
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-[37px] z-10 flex justify-center">
      <span
        className={`max-w-full rounded-full bg-night-950/90 px-2 py-0.5 text-center text-[10px] leading-[14px] font-semibold text-plush-100 shadow-[0_2px_6px_rgba(0,0,0,0.6)] ${marked ? 'ring-2 ring-brass-300' : 'ring-1 ring-white/15'}`}
        // Grown, it gives up most of its side padding, so "Warming Up" keeps
        // to one line down to 0.64 (87px of text on a 96px card).
        style={size > 10 ? { fontSize: size, lineHeight: `${Math.round(size * 1.15)}px`, paddingInline: 3 } : undefined}
      >
        {children}
      </span>
    </div>
  );
};

// Untracked: the rows are scaled to fit the felt (0.64 on a 320px phone), and
// letter-spaced capitals that small split apart at 1x, as the card's old 6px
// rarity line did ("COMM ON"). Hidden from a screen reader, as StatusChip is.
const StealthBand = ({ zoom = 1 }) => {
  const size = legibleSize(10, zoom);
  return (
    <div
      aria-hidden="true"
      className="absolute inset-x-0 top-[27px] z-10 flex items-center justify-center gap-1 bg-purple-700/90 py-0.5 text-[10px] font-bold leading-[14px] text-white"
      style={size > 10 ? { fontSize: size, lineHeight: `${Math.round(size * 1.2)}px` } : undefined}
    >
      <Ghost className="h-2.5 w-2.5" aria-hidden="true" />
      STEALTH
    </div>
  );
};

// Below this row zoom a table card's 10px name renders under 8px, and the
// card drops it (TeddyCard's `nameless`): its slot's words (CardWords) and
// its preview still name it.
const NAMELESS_BELOW = 0.8;

// A card in its slot, said once, in words (describeCard). The face beside it
// is aria-hidden: a control's children are presentational anyway, and where
// the card is content — Chuck's row outside targeting, a resting creature, a
// trap, the hand on Chuck's turn — the face read its numerals bare, its
// state chip twice, and below NAMELESS_BELOW no name at all. So a control
// gets the words as its description (its label names the card), and content
// reads them in place, name first.
const CardWords = ({ id, card, press, children }) => (
  <span id={id} className="sr-only">{press.role ? children : `${card.name}. ${children}`}</span>
);
// Press props with the description attached — only to a control: a card
// with no role is content, and its words are read in place.
const describedPress = (press, id) => (press.role ? { ...press, 'aria-describedby': id } : press);

// Whether an activation came from the keys (Enter or Space on a card, or a
// native button's keyboard click, which has no click count) or from
// assistive tech (a click with no pointer behind it), rather than a pointer.
const viaKeys = (e) => e?.type === 'keydown' || (e?.type === 'click' && e.detail === 0);

// What can hold the focus, for telling whether the focus has been lost.
const TABBABLE = 'button:not([disabled]), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

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

// The result panel's figures, from what recordBattleResult reported (or
// nothing yet): the battle's XP and coins, addXP's account of the level, and
// the Battle Pass tier either side of the XP. `stats` is the battle's own
// account of itself (battleStatsRef at the moment it ended), copied, because
// the ref is replaced for the next game while this panel is still leaving.
const rewardsFrom = (result, stats = null) => {
  const progress = result?.progress ?? null;
  return {
    xp: result?.xpGain ?? 0,
    coins: result?.coinsGain ?? 0,
    progress,
    tierBefore: progress ? battlePassTier(progress.seasonXPBefore) : 0,
    tierAfter: progress ? battlePassTier(progress.seasonXPAfter) : 0,
    stats: stats ? { ...stats } : {
      damageDealt: 0, healingDone: 0, cardsPlayed: 0, damageTaken: 0, fatigueTaken: 0, fatigueDealt: 0,
    },
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
      className={`absolute inset-0 z-50 dialog-scrim flex items-start justify-center overflow-y-auto ${SCRIM_PAD}`}
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
const GameBoard = forwardRef(function GameBoard({ onBackToMenu, onOpenShop, daily = null, brawl = null }, ref) {
  // Get store data
  // Not the deck or the difficulty: a game is dealt from a snapshot of
  // those (see the deal below), so nothing the store does mid-game can reach
  // a game in progress.
  const {
    soundEnabled: storeSoundEnabled,
    setSoundEnabled,
    markFirstFightSeen,
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
  const dailyRef = useRef(daily);
  dailyRef.current = daily;
  // A ladder ticket dealt instead of Chuck's crew. Read from a ref, like the
  // nightly fight, so a re-render cannot re-deal the table.
  const brawlRef = useRef(brawl);
  brawlRef.current = brawl;
  const brawlSettledRef = useRef(false);
  const tauntRef = useRef(null);
  const [tauntPick, setTauntPick] = useState(null);
  // One attested result. Also marks the battle finished for the unmount
  // path, so a win cannot be booked again as a walk-away.
  const settleBrawl = (won) => {
    const spec = brawlRef.current;
    if (!spec || brawlSettledRef.current) return false;
    brawlSettledRef.current = true;
    abandonHandledRef.current = true;
    if (typeof spec.onSettled === 'function') spec.onSettled(won, tauntRef.current);
    return true;
  };
  const dailySettledRef = useRef(false);
  const settleDaily = (won) => {
    const spec = dailyRef.current;
    if (!spec || dailySettledRef.current) return;
    dailySettledRef.current = true;
    useGameStore.getState().recordDailyResult(won, spec.key);
  };
  // Cuts and tabs Chuck's drinks leave for the next round. Refs, because the
  // opponent's turn is a timeout and must see what this turn just wrote.
  const barRef = useRef({ playerCut: 0, opponentCut: 0, playerTab: 0, opponentTab: 0 });
  const battleStatsRef = useRef({
    damageDealt: 0, healingDone: 0, cardsPlayed: 0, damageTaken: 0, fatigueTaken: 0, fatigueDealt: 0,
  });

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
  const [logOpen, setLogOpen] = useState(false);
  const [playerFatigue, setPlayerFatigue] = useState(0);
  const [opponentFatigue, setOpponentFatigue] = useState(0);
  const playerFatigueRef = useRef(0);
  const opponentFatigueRef = useRef(0);
  // Armed at the deal for an easy fight the player has not had the lesson
  // for. Stays on for this battle even after the flag is saved, so both
  // beats can finish; a later battle sees the flag and stays quiet.
  const [coachArmed, setCoachArmed] = useState(false);
  // The opening hand, before turn 1's draw. One decision a fight: keep, or
  // throw some back. deckReady stays false until it is made, so the draw
  // (and End Turn) wait.
  const [mulliganOpen, setMulliganOpen] = useState(false);
  const [mulliganPicks, setMulliganPicks] = useState(() => new Set());
  const [gameOver, setGameOver] = useState(false);
  const [winner, setWinner] = useState(null);
  const [showAbilityPopup, setShowAbilityPopup] = useState(null);
  const abilityTimerRef = useRef(null);
  const [battleRewards, setBattleRewards] = useState(() => rewardsFrom(null));
  // What the result panel says that varies (the headline, the line under it,
  // the receipt's footer), picked once when the game ends and kept: the panel
  // re-renders, and a pick made while rendering would change under the player.
  // `lastResultCopyRef` is the previous game's, so Play Again never answers
  // with the line it has just shown.
  const [resultCopy, setResultCopy] = useState(null);
  const lastResultCopyRef = useRef(null);
  const resultPanelRef = useRef(null);
  const settleResultCopy = useCallback((won) => {
    const copy = pickResultCopy(won, lastResultCopyRef.current);
    lastResultCopyRef.current = copy;
    setResultCopy(copy);
  }, []);

  // Where the keyboard focus goes after a keyboard move takes its control
  // away. A played hand card goes inert on its way out, a target stops being
  // a control once it is hit, End Turn leaves the screen for Chuck's turn,
  // Rally and Cancel go once used — and the focus fell to the page each time,
  // which resets a screen reader's place and leaves the board's own keys (I)
  // deaf until the player Tabs back in. Set by the move, acted on by the
  // effect further down once the board has re-rendered. Pointer moves leave
  // it alone.
  const refocusRef = useRef(null);
  const endTurnRef = useRef(null);

  // A line from one of the House's lists (BOARD_LINES), never the same one
  // twice running. Picked where the line is written or the banner raised,
  // never while rendering: the panel re-renders and a pick made there would
  // change under the player.
  const lastLinesRef = useRef({});
  const boardLine = useCallback((key) => {
    const line = pickLine(BOARD_LINES[key], lastLinesRef.current[key]);
    lastLinesRef.current[key] = line;
    return line;
  }, []);

  // Add to battle log. Ids must be unique — several entries are appended in
  // the same millisecond during the opponent's turn, so Date.now() collides
  // and duplicate React keys corrupt the rendered list.
  const logIdRef = useRef(0);
  // The rescued commentator. One canned line per turn; a Gemini key may add
  // a second. The ref keeps the same line from landing twice in a row.
  const lastBoothRef = useRef(null);
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
  // The line under the table on Chuck's turn, picked as the turn starts.
  const [thinkingLine, setThinkingLine] = useState(BOARD_LINES.thinking[0]);
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
      // A ladder ticket books the walk-away itself and does not pay the till,
      // the streak or the challenges. One result, attested to the server.
      if (settleBrawl(false)) return;
      abandonHandledRef.current = true;
      settleDaily(false);
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
      settleResultCopy(false);
      if (abandonRewardsRef.current) {
        setBattleRewards(rewardsFrom(abandonRewardsRef.current, battleStatsRef.current));
        showLevelUp(abandonRewardsRef.current.progress);
      }
      setWinner('opponent');
      setGameOver(true);
      setMvp(pickMvp(mvpRef.current));
      setRecap([...recapRef.current]);
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
    // clearAllTimeouts, showLevelUp and settleResultCopy are stable
    // useCallbacks (their own dependencies never change), so this still runs
    // once.
  }, [clearAllTimeouts, showLevelUp, settleResultCopy]);

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
      addToBattleLog(`You fire the confetti cannon. ${OPPONENT_NAME} is unimpressed, and covered in glitter. He'll be finding it for weeks. In places.`);
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
  const boardRef = useRef(null);
  const [fx, setFx] = useState([]);
  const [boardShake, setBoardShake] = useState(null);
  const [turnSlip, setTurnSlip] = useState(emptySlip);
  const [houseRule, setHouseRule] = useState(STANDARD_RULE);
  const [mvp, setMvp] = useState(null);
  const [recap, setRecap] = useState([]);
  const [replayId, setReplayId] = useState(null);
  const mvpRef = useRef({});
  const recapRef = useRef([]);
  const [aimId, setAimId] = useState(null);
  const fxIdRef = useRef(0);
  const shakeGen = useRef(0);
  const pushFx = useCallback((events) => {
    if (!events.length) return;
    const wave = strongestShake(events);
    if (wave) {
      const gen = ++shakeGen.current;
      setBoardShake(wave.shake);
      pulseImpact(wave.impact, { reduced: motionReduced() });
      safeTimeout(() => {
        if (shakeGen.current === gen) setBoardShake(null);
      }, 420);
    }
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

  // The banner across the felt: "Your turn" / "Chuck's turn" at each turn
  // boundary and at the start of a game, so the hand-over reads at a glance,
  // and "Last call" the once a game the house lights come up. Decorative (the
  // log announces both) and never in the way of a tap. Cleared at game over,
  // when the result dialog takes the table.
  //
  // One banner at a time. Last call outranks a turn banner it meets: the
  // wave that takes a side to its last points is followed 500 ms later by the
  // next turn's "Your turn", which used to be the only thing on the felt, so
  // each waits for the other's 1.3 s to end instead of cutting it short. A
  // turn banner is still replaced by the next turn's at once.
  const [banner, setBanner] = useState(null);
  const bannerIdRef = useRef(0);
  // When the turn banner, and the last-call banner (up or waiting), end.
  const turnBannerEndsRef = useRef(0);
  const lastCallBannerEndsRef = useRef(0);
  useEffect(() => {
    if (gameOver) {
      turnBannerEndsRef.current = 0;
      lastCallBannerEndsRef.current = 0;
      setBanner(null);
      return undefined;
    }
    if (!deckReady) return undefined;
    const id = ++bannerIdRef.current;
    // A turn boundary retires the last turn's callouts: on phones a toast
    // shares the centre line with the banner and would sit on top of it.
    dismissToasts();
    const timers = [];
    const show = () => {
      setBanner({
        id,
        turn: currentTurn,
        text: boardLine(currentTurn === 'player' ? 'bannerPlayer' : 'bannerChuck'),
      });
      turnBannerEndsRef.current = Date.now() + BANNER_MS;
      timers.push(setTimeout(() => setBanner((b) => (b?.id === id ? null : b)), BANNER_MS));
    };
    const wait = lastCallBannerEndsRef.current - Date.now();
    if (wait > 0) timers.push(setTimeout(show, wait));
    else show();
    return () => {
      timers.forEach(clearTimeout);
      // Gone with its run, so a banner waiting out a last call is not left
      // standing from the run before, and a replaced one does not hold up
      // the next.
      turnBannerEndsRef.current = 0;
      setBanner((b) => (b?.id === id ? null : b));
    };
  }, [currentTurn, deckReady, gameOver, dismissToasts, boardLine]);

  // Last call. The first time either side is down to LAST_CALL_HP or fewer
  // (lastCall.js), once a game: the room lights up (data-last-call on the
  // board, which index.css answers with .house-lights and the lamp over the
  // felt), the log says so (it is the accessible record: every light and the
  // banner are aria-hidden), the banner comes up, and Chuck says a line
  // from his lastCall pool. `lastCallRef` is the game it fired in, so a new
  // game (gameId) is a new night.
  const [lastCall, setLastCall] = useState(false);
  const lastCallRef = useRef(null);
  const lastCallSpokeRef = useRef(null);
  const raiseLastCallBanner = useCallback(() => {
    // After a turn banner that is up, never over it.
    const wait = Math.max(0, turnBannerEndsRef.current - Date.now());
    const id = ++bannerIdRef.current;
    lastCallBannerEndsRef.current = Date.now() + wait + BANNER_MS;
    const show = () => {
      setBanner({ id, lastCall: true });
      safeTimeout(() => setBanner((b) => (b?.id === id ? null : b)), BANNER_MS);
    };
    if (wait > 0) safeTimeout(show, wait);
    else show();
  }, [safeTimeout]);
  useEffect(() => {
    const due = lastCallDue({
      gameId, firedIn: lastCallRef.current, deckReady, gameOver, playerHealth, opponentHealth,
    });
    if (!due) return;
    lastCallRef.current = gameId;
    // The commit it spoke in, so oppNearDeath (below, the later effect, which
    // would otherwise replace this bubble) can stand aside for it.
    lastCallSpokeRef.current = { gameId, playerHealth, opponentHealth };
    setLastCall(true);
    addToBattleLog(lastCallLog(due.side, due.hp));
    raiseLastCallBanner();
    // Chuck gloats when the player is the one down, and bluffs when he is. He
    // waits for the banner to clear: it sits on the felt's centre line, where
    // his bubble is, and covered half of what he said for a second.
    const pool = due.side === 'opponent' ? 'lastCallChuckDown' : 'lastCall';
    const hold = Math.max(0, lastCallBannerEndsRef.current - Date.now());
    if (hold > 0) safeTimeout(() => speak(pool), hold);
    else speak(pool);
  }, [gameId, deckReady, gameOver, playerHealth, opponentHealth, addToBattleLog, raiseLastCallBanner, safeTimeout, speak]);

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

  // The difficulty this game was dealt at: Chuck's energy budget reads it
  // all game, so a change in Settings applies from the next deal.
  const dealtDifficultyRef = useRef('normal');

  // Deal. From a snapshot of the deck and the difficulty taken here, and once
  // per game (gameId), never again until Play Again or the next battle. It
  // used to depend on the store's currentDeck, and every rehydrate — each
  // focus and each return to the tab, see useRehydrateOnFocus — puts a newly
  // parsed array there: one alt-tab re-dealt the game in progress, with a new
  // hand, a new crew for Chuck at full HP and the log restarted, while the
  // table and the turn stayed as they were.
  useEffect(() => {
    barRef.current = { playerCut: 0, opponentCut: 0, playerTab: 0, opponentTab: 0 };
    const { currentDeck, difficulty: aiDifficulty } = useGameStore.getState();
    const brawlSpec = brawlRef.current;
    // A saved deck is piloted at normal, whatever the player has Chuck set to.
    dealtDifficultyRef.current = brawlSpec ? 'normal' : aiDifficulty;
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

    // A nightly fight brings its own crew and its own rules. A normal fight
    // still rolls a fresh crew scaled by the difficulty it was dealt at.
    const spec = dailyRef.current;
    let opponentCards;
    let crewName;
    let healthMod = 0;
    let faceHp = 30;
    if (spec) {
      const bump = spec.modifier.opponentAttack || 0;
      opponentCards = spec.deck.map((card, idx) => ({
        ...card,
        instanceId: `d-${card.id}-${idx}`,
        ...(bump && card.type === 'action' ? { attack: card.attack + bump } : {}),
      }));
      crewName = spec.crewName;
    } else if (brawlSpec?.cards?.length) {
      opponentCards = brawlSpec.cards.map((card, idx) => ({
        ...card,
        instanceId: card.instanceId || `g-${card.id}-${idx}`,
      }));
      crewName = brawlSpec.label || 'a saved deck';
      const asked = Number(brawlSpec.faceHp);
      faceHp = Number.isInteger(asked) && asked >= 1 && asked <= 30 ? asked : 30;
    } else {
      const built = buildOpponentDeck(aiDifficulty);
      opponentCards = built.cards;
      crewName = built.crewName;
      healthMod = OPPONENT_HEALTH_MOD_BY_DIFFICULTY[aiDifficulty] ?? 0;
    }

    const rule = (spec || brawlSpec) ? STANDARD_RULE : readHouseRule();
    let initialOpponentDeck = shuffleDeck(opponentCards);
    if (rule.boss) {
      initialOpponentDeck = [{ ...BOSS_CARD, instanceId: 'o-boss' }, ...initialOpponentDeck.slice(0, 7)];
    }

    setHouseRule(rule);
    mvpRef.current = {};
    recapRef.current = [];
    setMvp(null);
    setRecap([]);
    const startHp = (spec?.modifier.startingHealth ?? 30) + rule.hp;
    const opponentHp = brawlSpec?.cards?.length ? faceHp : startHp + healthMod + rule.chuckHp;
    setPlayerHealth(startHp);
    setOpponentHealth(opponentHp);
    setOpponentMaxHealth(opponentHp);
    setPlayerEnergy(Math.min(MAX_ENERGY, energyForTurn(1) + (spec?.modifier.extraEnergy || 0) + rule.energy));

    const playerInitialHand = initialPlayerDeck.slice(0, 5);
    const playerRemainingDeck = initialPlayerDeck.slice(5);
    beginHouseTape({
      kind: brawlSpec ? 'ghost' : 'house',
      seed: 1,
      deckA: initialPlayerDeck.map((card) => card.id),
      deckB: initialOpponentDeck.map((card) => card.id),
      names: [useGameStore.getState().playerName || 'You', brawlSpec?.rivalName || OPPONENT_NAME],
      rules: { id: rule.id, hp: rule.hp || 0, energy: rule.energy || 0, damage: rule.damage || 0 },
    });

    setPlayerHand(playerInitialHand);
    setPlayerDeck(playerRemainingDeck);

    // Chuck's opener is summoning-sick too, so neither side swings on its
    // first turn. Without this the rule is lopsided: the player's turn-1 play
    // has to sit still while the opener — placed before the game even starts —
    // hits it for free, handing Chuck first blood every single game.
    const opener = initialOpponentDeck[0];
    const mulled = mulliganOpponentDeck(initialOpponentDeck.slice(1));
    setOpponentField([{ ...withHp(opener), summoningSick: true }]);
    setOpponentDeck(mulled.deck);

    playerFatigueRef.current = 0;
    opponentFatigueRef.current = 0;
    setPlayerFatigue(0);
    setOpponentFatigue(0);
    setLogOpen(false);
    setMulliganPicks(new Set());
    setMulliganOpen(true);
    setDeckReady(false);
    // The lesson is for a first easy fight, or the one How to play just
    // asked to replay. Read the flag here, at the deal. coachNextFight is
    // this fight only, and it is not part of the save.
    const { firstFightSeen, coachNextFight } = useGameStore.getState();
    if (coachNextFight) useGameStore.setState({ coachNextFight: false });
    setCoachArmed(!spec && !brawlSpec && ((aiDifficulty === 'easy' && !firstFightSeen) || coachNextFight === true));

    // A fresh log at every deal, rather than appending to whatever is there.
    // Everything above replaces state, so this effect can run twice and end
    // the same — and in development it does: StrictMode mounts, unmounts and
    // remounts, and appending showed the intro twice, the first copy naming
    // a crew from the throwaway deal that is not the one in play. (The two
    // lines after it append to that fresh log, so a second run still ends
    // with one copy of each.) Chuck's opening line goes between the intro and
    // the hand-over, in the order it is said.
    setTurnSlip(emptySlip());
    const intro = [brawlSpec
      ? `${brawlSpec.rivalName || 'A rival'} stepped out. The deck stayed. Still warm.`
      : `${OPPONENT_NAME} slams his deck on the table with ${crewName} at his back. Difficulty: ${aiDifficulty.toUpperCase()} ${crewTaunt(crewName)}`];
    // Chuck's mood is his. A ghost fight is someone else's deck, so it gets their greeting instead.
    if (!brawlSpec) intro.push(mindLine(aiDifficulty));
    if (!brawlSpec && rule.id !== 'standard') intro.push(rule.blurb);
    const greeting = brawlSpec ? tauntLine(brawlSpec.greeting) : null;
    if (greeting) intro.push(greeting);
    if (mulled.tossed > 0) intro.push(mulliganOpponentLine(OPPONENT_NAME, mulled.tossed));
    if (spec) intro.push(`${spec.modifier.name}. ${spec.modifier.rules}`);
    startBattleLog(intro);
    // The clock is read here, once, at the deal: a battle begun between
    // midnight and five in the morning opens differently, and one that runs
    // past the hour does not change its mind.
    speak(startPoolFor(new Date()));
    addToBattleLog('Your turn. Make it hurt.');
    noteBooth(addToBattleLog, lastBoothRef);
    // The draw waits on the mulligan. deckReady is set when they keep or swap.
  }, [startBattleLog, addToBattleLog, gameId, speak]);

  // Check for game over. Opponent death is checked first so that a simultaneous
  // lethal (both reach 0 in the same commit) counts as a win for the player who
  // dealt it, rather than an unconditional loss.
  useEffect(() => {
    if (gameOver) return;
    if (opponentHealth <= 0) {
      clearAllTimeouts(); // cancel any queued opponent-turn steps
      setGameOver(true);
      setMvp(pickMvp(mvpRef.current));
      setRecap([...recapRef.current]);
      const tape = takeHouseTape();
      const compiled = compileTape(tape);
      if (compiled) {
        saveReplay(compiled).then((saved) => { if (saved?.id) setReplayId(saved.id); });
      }
      setWinner('player');
      settleDaily(true);
      setOppQuip(null);
      setPlayerQuip(null); // its dismiss timer was just cancelled by clearAllTimeouts
      setEndQuip(pickQuip('oppLoses'));
      settleResultCopy(true);
      playSound('victory');

      // A ladder ticket attests the result and stops there: no coins, no XP,
      // no challenge credit. Chuck's fights still pay the till.
      if (settleBrawl(true)) {
        setBattleRewards(rewardsFrom(null, battleStatsRef.current));
      } else {
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
        setBattleRewards(rewardsFrom(result, battleStatsRef.current));
        showLevelUp(result.progress);

        // Sync to server (fire and forget - don't block UI)
        syncBattleResult(true, battleStatsRef.current.damageDealt, battleStatsRef.current.healingDone, coinsGain, useGameStore.getState().ownerUserId)
          .catch(err => console.error('Battle sync failed:', err));
        // recordBattleResult ran addXP synchronously, so the store level/xp are
        // now current. Push them so the leaderboard's rival rows stop reading as
        // Level 1 (players.experience is otherwise never written).
        syncLevelToServer();
      }

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
      setMvp(pickMvp(mvpRef.current));
      setRecap([...recapRef.current]);
      const lostTape = takeHouseTape();
      const lostLog = compileTape(lostTape);
      if (lostLog) saveReplay(lostLog).then((saved) => { if (saved?.id) setReplayId(saved.id); });
      setWinner('opponent');
      settleDaily(false);
      setOppQuip(null);
      setPlayerQuip(null); // its dismiss timer was just cancelled by clearAllTimeouts
      setEndQuip(pickQuip('oppWins'));
      settleResultCopy(false);
      playSound('defeat');

      if (settleBrawl(false)) {
        setBattleRewards(rewardsFrom(null, battleStatsRef.current));
      } else {
        // Record defeat — store now handles consolation coins internally
        const result = recordBattleResult(
          false,
          battleStatsRef.current.damageDealt,
          battleStatsRef.current.healingDone,
          playerHealth,
          battleStatsRef.current.cardsPlayed
        );
        const { coinsGain } = result;
        setBattleRewards(rewardsFrom(result, battleStatsRef.current));
        showLevelUp(result.progress);

        // Sync to server (fire and forget - don't block UI)
        syncBattleResult(false, battleStatsRef.current.damageDealt, battleStatsRef.current.healingDone, coinsGain, useGameStore.getState().ownerUserId)
          .catch(err => console.error('Battle sync failed:', err));
        // Keep the server level/xp current even on a loss (a loss still grants XP).
        syncLevelToServer();
      }
    }
  }, [playerHealth, opponentHealth, gameOver, playSound, recordBattleResult, clearAllTimeouts, showLevelUp, settleResultCopy]);

  // Chuck starts sweating when he's nearly unstuffed — once per game.
  useEffect(() => {
    if (gameOver) return;
    if (nearDeathDue({
      gameId, quipped: nearDeathQuippedRef.current, gameOver, playerHealth, opponentHealth,
      lastCallSpoke: lastCallSpokeRef.current,
    })) {
      // Last call, spoken in this commit, wins (see nearDeathDue).
      nearDeathQuippedRef.current = true;
      speak('oppNearDeath');
    }
  }, [opponentHealth, playerHealth, gameId, gameOver, speak]);

  useEffect(() => {
    if (!gameOver || !coachArmed) return;
    setCoachArmed(false);
    markFirstFightSeen();
  }, [gameOver, coachArmed, markFirstFightSeen]);

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

    const spec = dailyRef.current;
    const clock = shouldFatigue({
      deckEmpty: playerDeck.length === 0,
      turn: turnCount,
      fatigueFromTurn: spec?.modifier.fatigueFromTurn,
    });
    if (clock) {
      const amount = fatigueForEmptyDraw(playerFatigueRef.current);
      playerFatigueRef.current = amount;
      setPlayerFatigue(amount);
      setPlayerHealth((prev) => Math.max(0, prev - amount));
      battleStatsRef.current.damageTaken += amount;
      battleStatsRef.current.fatigueTaken += amount;
      pushFx([{ face: 'player', hit: true, tone: 'damage', text: `−${amount}` }]);
      addToBattleLog(fatigueLine('player', amount));
    }
    if (playerDeck.length > 0 && playerHand.length >= MAX_HAND_SIZE) {
      addToBattleLog(`Hand is full (${MAX_HAND_SIZE}) — skipped draw. Put something down.`);
    } else if (playerDeck.length > 0) {
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
  }, [deckReady, phase, currentTurn, turnCount, gameId, playerDeck, playerHand.length, gameOver, addToBattleLog, playSound, safeTimeout, pushFx]);

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

  // Play a card from hand. Says whether it did, for a caller that acts on a
  // play (pressHandCard's keyboard focus).
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
        title: "Tapped out",
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
      if (turnSlip.played + 1 === 2) addToBattleLog(COMBO_PLAY);
      setTurnSlip((slip) => notePlay(slip));
      recapRef.current = pushRecap(recapRef.current, `Played ${card.name}`);
      playSound('cardPlay');
      noteHouse('a', { t: 'play', c: card.id });
      return true;
    }

    // Handle action/trap cards
    if (playerField.length >= MAX_FIELD_SIZE) {
      // Nothing removes a teddy by hand, so the copy cannot say "remove one".
      toast({
        title: "Standing room only",
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
    const arrival = card.type === 'action'
      ? resolveArrival({
        card: cardToPlay,
        ownField: [...playerField, cardToPlay],
        enemyField: opponentField,
        ownHp: playerHealth,
        enemyHp: opponentHealth,
        maxHp: PLAYER_MAX_HEALTH,
      })
      : null;

    cancelTargeting();
    setPlayerField(arrival ? arrival.ownField : (prev) => [...prev, cardToPlay]);
    setPlayerHand(prev => prev.filter(c => c.instanceId !== card.instanceId));
    setPlayerEnergy(prev => prev - cost);
    setPlayerMomentum(prev => Math.min(MOMENTUM_MAX, prev + 1));
    battleStatsRef.current.cardsPlayed += 1;
    if (turnSlip.played + 1 === 2) addToBattleLog(COMBO_PLAY);
    setTurnSlip((slip) => notePlay(slip));
    recapRef.current = pushRecap(recapRef.current, `Played ${card.name}`);
    playSound('cardPlay');

    // A card with a rule gets the ability callout, which names the rule it
    // brings; it clears any toast left over from earlier in the turn, which
    // would otherwise stack on it on the table's centre line. A plain card
    // gets nothing more: the card landing on the table is the news, and the
    // log entry below records it (and is what a screen reader hears) — a
    // "Card Played" toast on every play only repeated both.
    // One timer for the callout: an earlier play's would otherwise take a
    // later callout down early.
    if (card.ability && card.ability !== 'none') {
      dismissToasts();
      setShowAbilityPopup({ name: card.name, ability: card.ability });
      clearTimeout(abilityTimerRef.current);
      abilityTimerRef.current = safeTimeout(() => setShowAbilityPopup(null), 1500);
    }

    addToBattleLog(`Played ${card.name}${card.ability && card.ability !== 'none' ? ` (${card.ability})` : ''}`);
    if (arrival) {
      setOpponentField(arrival.enemyField);
      if (arrival.ownHp !== playerHealth) {
        setPlayerHealth(arrival.ownHp);
        battleStatsRef.current.healingDone += arrival.healing;
      }
      if (arrival.enemyHp !== opponentHealth) {
        setOpponentHealth(arrival.enemyHp);
        battleStatsRef.current.damageDealt += arrival.damageToEnemy;
      }
      arrival.logs.forEach(addToBattleLog);
    }
    noteHouse('a', { t: 'play', c: card.id });
    return true;
  };

  // Apply special card effects. What a special did shows on the board — a
  // heal floats its number off your health, a draw lands in the hand, a buff
  // floats over each creature — and the log records it, so none of that gets
  // a toast. A toast is for the case the board cannot show: a legal play
  // that did nothing.
  const applySpecialEffect = (card) => {
    const bar = commitBarSpecial({
      health: playerHealth,
      maxHealth: PLAYER_MAX_HEALTH,
      field: playerField,
      deck: playerDeck,
      hand: playerHand.filter((c) => c.instanceId !== card.instanceId),
      handRoom: Math.max(0, MAX_HAND_SIZE - Math.max(0, playerHand.length - 1)),
    }, card);
    if (bar) {
      if (bar.healed > 0) {
        setPlayerHealth(bar.health);
        battleStatsRef.current.healingDone += bar.healed;
        pushFx([{ face: 'player', tone: 'heal', text: `+${bar.healed}` }]);
        setTurnSlip((slip) => noteHeal(slip, bar.healed));
        playSound('heal');
      }
      if (bar.topped > 0 || bar.buff > 0) setPlayerField(bar.field);
      if (bar.drawn > 0) {
        setPlayerHand(bar.hand);
        setPlayerDeck(bar.deck);
        playSound('draw');
      }
      if (bar.energyCut) barRef.current.opponentCut += bar.energyCut;
      if (bar.due) barRef.current.playerTab += bar.due;
      addToBattleLog(bar.log);
      if (!bar.healed && !bar.topped && !bar.buff && !bar.drawn && !bar.energyCut && !bar.due) {
        toast({ title: 'Already fully stuffed', description: bar.log });
      }
      return;
    }
    switch (card.effect) {
      case 'heal': {
        // Credit the healing that actually landed, not the card's face value.
        // Healing caps at 30, so playing a +10 heal at 28 HP restores 2 — but
        // the full 10 was being counted toward the 'Medic Bear' achievement and
        // the daily healing challenge, letting both be farmed at full HP.
        // Chuck behind the bar tops the pour.
        const amount = card.amount + pourExtra(playerField);
        const healed = Math.min(PLAYER_MAX_HEALTH, playerHealth + amount) - playerHealth;
        setPlayerHealth(prev => Math.min(PLAYER_MAX_HEALTH, prev + amount));
        battleStatsRef.current.healingDone += healed;
        playSound('heal');
        if (healed > 0) {
          pushFx([{ face: 'player', tone: 'heal', text: `+${healed}` }]);
          setTurnSlip((slip) => noteHeal(slip, healed));
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
          toast({ title: "Keg's empty", description: `${card.name} came up empty — your deck is out of cards.` });
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
  const finishFirstFight = () => {
    if (!coachArmed) return;
    setCoachArmed(false);
    markFirstFightSeen();
  };

  const selectCardForAttack = (card) => {
    if (currentTurn !== 'player' || phase !== 'main' || gameOver) return;
    if (card.type === 'trap') {
      toast({ title: "Let it come to you", description: `${card.name} springs automatically when an enemy strikes it.`, variant: "destructive" });
      return;
    }
    if (card.summoningSick && card.ability !== 'rush') {
      toast({
        title: "Still finding the floor",
        description: `${card.name} only just staggered in — it can swing from your next turn.`,
        variant: "destructive",
      });
      return;
    }
    if (card.hasAttacked) {
      toast({ title: "Needs a minute", description: `${card.name} has already attacked this turn`, variant: "destructive" });
      return;
    }

    // Selection always proceeds; the attack step enforces taunt/protect and
    // allows a direct hit when only traps or stealthed cards remain.
    setSelectedCard(card);
    setTargetingMode(true);
    // On narrow screens a toast sits on the centre line, exactly where the
    // "Pick a victim" prompt appears — and so, at every width, does the
    // ability callout, an opaque panel that hid the prompt for the rest of
    // its 1.5s when the player picked an attacker straight after a play. Both
    // have done their job once the player moves on.
    dismissToasts();
    setShowAbilityPopup(null);
    // And the attacker's own preview: below ~900px there is no room beside
    // the rows, so a hover preview of a card on your side opens over Chuck's
    // row — over the targets — and the first click on one only closed it.
    hidePreview();
  };

  // Attack a target. `e` is the activation, so a keyboard attack can put the
  // focus somewhere once the target stops being a control (see refocusRef).
  const attackTarget = (target, e) => {
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
    const struck = attacker.ability === 'blackout' ? (pickBlackoutTarget(validTargets) || target) : target;

    // Resolve against the target's HP: it survives a non-lethal hit (and its
    // fury fires), or dies and trample overkill spills to the opponent's face.
    // Pass playerField so a 'royal' ally on the attacker's side buffs the hit.
    // The outcome is drawn on the table (the lunge, the hit, the number, the
    // crumple) and written to the log, so it gets no toast: a toast for every
    // hit covered the log and the table to repeat them.
    const { survivor, overkill, dmg } = resolveCreatureHit(attacker, struck, playerField, houseRule.damage || 0, { health: playerHealth });
    const impact = classifyHit({ dmg, killed: !survivor, overkill });
    playSound('attack');
    battleStatsRef.current.damageDealt += dmg;
    if ((turnSlip.swings || 0) + 1 === 2) addToBattleLog(COMBO_SWING);
    setTurnSlip((slip) => noteHit(slip, { damage: dmg, killed: !survivor, face: survivor ? 0 : overkill }));
    mvpRef.current = tallyMvp(mvpRef.current, { id: attacker.instanceId, name: attacker.name, damage: dmg });
    // On a kill the card shows what it actually lost, and any trample shows
    // on the face: the two add up to the hit, rather than the hit twice over.
    const taken = survivor ? dmg : dmg - overkill;
    const flavor = hitFlavor({ dmg, killed: !survivor, overkill });
    const mark = (event) => withImpact(flavor ? { ...event, flavor } : event, impact);
    pushFx([
      { card: attacker.instanceId, strike: true },
      ...(taken > 0 ? [mark({ card: struck.instanceId, hit: true, tone: 'damage', text: `−${taken}` })] : []),
      ...(!survivor && overkill > 0 ? [mark({ face: 'opponent', hit: true, tone: 'damage', text: `−${overkill}` })] : []),
    ]);

    if (survivor) {
      setOpponentField(prev => prev.map(c => c.instanceId === struck.instanceId ? survivor : c));
      if (struck.ability === 'fury') {
        addToBattleLog(gainedFuryStack(struck, survivor)
          ? `${struck.name}'s fury activated! +1 attack`
          : `${struck.name} is already as furious as they get — capped at +3.`);
      }
      addToBattleLog(`${attacker.name} smacked ${struck.name} for ${dmg} (${survivor.currentHp} HP left)`);
      if (attacker.ability === 'cutoff' && survivor.hungover) {
        addToBattleLog(`${attacker.name} cut ${struck.name} off. They can watch the next one.`);
      }
    } else {
      setOpponentField(prev => prev.filter(c => c.instanceId !== struck.instanceId));
      if (overkill > 0) setOpponentHealth(prev => Math.max(0, prev - overkill));
      addToBattleLog(`UNSTUFFED! ${attacker.name} took ${struck.name} apart${overkill > 0 ? ` — ${overkill} trampled right into ${OPPONENT_NAME}'s beans` : ''}`);
      speak('oppLosesCreature');
    }
    const aside = hitAside({
      attacker: attacker.name, target: struck.name, killed: !survivor, overkill, dmg, foe: OPPONENT_NAME,
    });
    if (aside) addToBattleLog(aside);
    recapRef.current = pushRecap(recapRef.current, `${attacker.name} hit ${struck.name} for ${dmg}`);

    setPlayerField(prev => prev.map(c => (
      c.instanceId === selectedCard.instanceId ? stampSwing(c) : c
    )));

    setPlayerMomentum(prev => Math.min(MOMENTUM_MAX, prev + 2));
    finishFirstFight();
    setSelectedCard(null);
    setTargetingMode(false);
    setAimId(null);
    if (viaKeys(e)) refocusRef.current = { kind: 'attack' };
    noteHouse('a', { t: 'hit', c: attacker.id, g: struck.id });
  };

  // Attack opponent directly
  const attackOpponentDirectly = (e) => {
    if (!selectedCard || !targetingMode) return;

    const validTargets = getValidTargets(playerField, opponentField);
    if (validTargets.length > 0) {
      toast({
        title: "Goons first",
        description: `${OPPONENT_NAME}'s goons are in the way. Deal with them first.`,
        variant: "destructive"
      });
      return;
    }

    // Re-read the attacker before the trap-or-face split. A Quickie that just
    // arrived can hit creatures and must not reach the face, or spring a trap
    // by swinging at it, until next turn.
    const attacker = playerField.find(c => c.instanceId === selectedCard.instanceId) || selectedCard;
    if (!canSwingFace(attacker)) {
      toast({
        title: 'Not on the first date',
        description: `${attacker.name} only takes the other bears this turn. ${OPPONENT_NAME} can wait.`,
        variant: 'destructive',
      });
      return;
    }

    // No blocking creatures. If the opponent has a trap on the field, the attack
    // springs it (the attacker takes the trap damage and the trap is consumed)
    // instead of hitting face — so traps stay meaningful without permanently
    // gating the attack: the next strike gets through.
    const trap = opponentField.find(c => c.type === 'trap');
    let interestAttack = null;
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
      const taxed = applyInterest(attacker, trap);
      if (taxed.attack !== attacker.attack) {
        interestAttack = taxed.attack;
        addToBattleLog(`${trap.name} takes ${trap.interest} off ${attacker.name}. The tab collects.`);
      }
    } else {
      // The attacker was re-read above, so a Rally mid-targeting is already
      // in `attacker`. effectiveAttack folds in any royal ally on top.
      const faceDamage = effectiveAttack(attacker, playerField, { health: playerHealth }) + (houseRule.damage || 0);
      const impact = classifyHit({ dmg: faceDamage, killed: faceDamage >= opponentHealth, overkill: 0 });
      playSound('attack');
      const flavor = hitFlavor({ dmg: faceDamage, killed: faceDamage >= opponentHealth, overkill: 0 });
      pushFx([
        { card: attacker.instanceId, strike: true },
        ...(faceDamage > 0 ? [withImpact({ face: 'opponent', hit: true, tone: 'damage', text: `−${faceDamage}`, ...(flavor ? { flavor } : {}) }, impact)] : []),
      ]);
      setOpponentHealth(prev => Math.max(0, prev - faceDamage));
      battleStatsRef.current.damageDealt += faceDamage;
      if ((turnSlip.swings || 0) + 1 === 2) addToBattleLog(COMBO_SWING);
      setTurnSlip((slip) => noteHit(slip, { damage: faceDamage, face: faceDamage }));
      mvpRef.current = tallyMvp(mvpRef.current, { id: attacker.instanceId, name: attacker.name, damage: faceDamage });
      recapRef.current = pushRecap(recapRef.current, `${attacker.name} hit ${OPPONENT_NAME} for ${faceDamage}`);
      addToBattleLog(`${attacker.name} decked ${OPPONENT_NAME} in the face for ${faceDamage}!`);
      const aside = hitAside({
        attacker: attacker.name, dmg: faceDamage, killed: faceDamage >= opponentHealth, face: true, foe: OPPONENT_NAME,
      });
      if (aside) addToBattleLog(aside);
      if (faceDamage >= 4) speak('oppTakesFaceHit');
    }

    setPlayerField(prev => prev.map(c => (
      c.instanceId === selectedCard.instanceId
        ? stampSwing(interestAttack === null ? c : { ...c, attack: interestAttack })
        : c
    )));

    setPlayerMomentum(prev => Math.min(MOMENTUM_MAX, prev + 3));
    finishFirstFight();
    setSelectedCard(null);
    setTargetingMode(false);
    setAimId(null);
    if (viaKeys(e)) refocusRef.current = { kind: 'attack' };
    noteHouse('a', { t: 'face', c: attacker.id });
  };

  // End turn
  const endTurn = (e) => {
    // Guard like every sibling handler: only the player, on their own turn, ends
    // it — so a stray call during the opponent's turn can't queue a second
    // executeOpponentTurn.
    if (currentTurn !== 'player') return;
    // End Turn leaves the screen for Chuck's turn; from the keyboard, the
    // focus goes back to it when it returns.
    if (viaKeys(e)) refocusRef.current = { kind: 'turn' };
    const tip = tabTip(playerField);
    if (tip && playerHealth < PLAYER_MAX_HEALTH) {
      const gained = Math.min(tip, PLAYER_MAX_HEALTH - playerHealth);
      setPlayerHealth((prev) => Math.min(PLAYER_MAX_HEALTH, prev + tip));
      battleStatsRef.current.healingDone += gained;
      addToBattleLog(`The tab tops you up. +${gained} HP.`);
    }
    setPlayerField(prev => readyCreatures(prev));
    setSelectedCard(null);
    setTargetingMode(false);
    setAimId(null);
    setCurrentTurn('opponent');
    setPhase('end');
    addToBattleLog(slipLine(turnSlip));
    addToBattleLog(boardLine('endTurn'));
    noteHouse('a', { t: 'end' });
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
    addToBattleLog('RALLY! Your teddies scream something unprintable — +1 attack, fully restuffed!');
    speak('playerRally');
  };

  // Opponent AI turn
  const executeOpponentTurn = () => {
    setThinkingLine(boardLine('thinking'));
    addToBattleLog(boardLine('chuckTurn'));

    // An empty deck is a draw he cannot make. Fatigue lands before he plays
    // or swings, and a lethal one ends the turn so the corpse does not also attack.
    const spec = dailyRef.current;
    const clock = shouldFatigue({
      deckEmpty: opponentDeck.length === 0,
      turn: turnCount,
      fatigueFromTurn: spec?.modifier.fatigueFromTurn,
    });
    if (clock) {
      const amount = fatigueForEmptyDraw(opponentFatigueRef.current);
      opponentFatigueRef.current = amount;
      setOpponentFatigue(amount);
      const hp = Math.max(0, opponentHealth - amount);
      setOpponentHealth(hp);
      battleStatsRef.current.damageDealt += Math.min(opponentHealth, amount);
      battleStatsRef.current.fatigueDealt += Math.min(opponentHealth, amount);
      pushFx([{ face: 'opponent', hit: true, tone: 'damage', text: `−${amount}` }]);
      addToBattleLog(fatigueLine('opponent', amount, OPPONENT_NAME));
      if (hp <= 0) return;
    }

    // Remove stealth from opponent cards. Compute the cleared field once and
    // use it for BOTH the state update and the attack loop below — the loop
    // otherwise iterates this closure's stale snapshot, where a stealth card
    // played last turn still reads stealthActive and skips an extra full turn
    // of attacks.
    const activeOpponentField = opponentField.map(c => ({ ...c, stealthActive: false }));
    setOpponentField(prev => prev.map(c => ({ ...c, stealthActive: false })));
    if (houseRule.boss && bossMends(activeOpponentField)) {
      const room = Math.max(0, opponentMaxHealth - opponentHealth);
      const healed = Math.min(BOSS_HEAL, room);
      if (healed > 0) {
        setOpponentHealth((hp) => Math.min(opponentMaxHealth, hp + healed));
        addToBattleLog(`Donna is still catcalling. ${OPPONENT_NAME} mends ${healed}.`);
        pushFx([{ face: 'opponent', tone: 'heal', text: `+${healed}` }]);
      }
    }

    // Opponent plays every card it can afford within its per-turn energy
    // budget (difficulty-scaled) while the field has room. Only played cards
    // leave the deck, so a full board never mills it.
    // At the difficulty this game was dealt at, not the live setting.
    const owed = payTab(opponentHealth, barRef.current.opponentTab);
    barRef.current.opponentTab = 0;
    if (owed.paid) {
      setOpponentHealth(owed.health);
      addToBattleLog(`${OPPONENT_NAME} pays the tab. -${owed.paid} HP.`);
      if (owed.health <= 0) return;
    }
    const energyBudget = energyAfterCut(
      (OPPONENT_ENERGY_BY_DIFFICULTY[dealtDifficultyRef.current] ?? OPPONENT_ENERGY_BY_DIFFICULTY.normal)
      + ((dailyRef.current?.modifier.extraEnergy && turnCount === 1) ? dailyRef.current.modifier.extraEnergy : 0)
      + (houseRule.energy || 0),
      barRef.current.opponentCut,
    );
    barRef.current.opponentCut = 0;
    // Pass activeOpponentField so a 'swarm' card in the opponent's hand is
    // budgeted at its discounted cost under the same rule the player follows.
    const { plays, remainingDeck } = planOpponentPlays({
      difficulty: dealtDifficultyRef.current,
      deck: opponentDeck,
      field: activeOpponentField,
      energy: energyBudget,
      maxField: MAX_FIELD_SIZE,
      enemyField: readyCreatures(playerField),
      ownHp: opponentHealth,
    });
    // Bar specials settle first. Creatures the opponent plays this turn then
    // run their arrivals on a ready copy of the player's field, so a kiss or
    // an eggnog survives the wave's write-back.
    let opponentSide = {
      health: owed.paid ? owed.health : opponentHealth,
      maxHealth: opponentMaxHealth,
      field: activeOpponentField,
      deck: remainingDeck,
      hand: [],
      handRoom: 0,
    };
    const bodies = [];
    for (const c of plays) {
      const committed = commitBarSpecial(opponentSide, c);
      if (!committed) {
        bodies.push(c);
        continue;
      }
      opponentSide = {
        ...opponentSide,
        health: committed.health,
        field: committed.field,
        deck: committed.deck,
      };
      if (committed.energyCut) barRef.current.playerCut += committed.energyCut;
      if (committed.due) barRef.current.opponentTab += committed.due;
      addToBattleLog(committed.log);
    }
    let wavePlayer = readyCreatures(playerField);
    let waveOpp = [...opponentSide.field];
    let wavePlayerHp = playerHealth;
    let waveOppHp = opponentSide.health;
    for (const raw of bodies) {
      const card = {
        ...withHp(raw),
        summoningSick: raw.type === 'action',
        ...(raw.ability === 'stealth' ? { stealthActive: true } : {}),
      };
      if (card.type !== 'action') {
        waveOpp = [...waveOpp, card];
        continue;
      }
      const arrival = resolveArrival({
        card,
        ownField: [...waveOpp, card],
        enemyField: wavePlayer,
        ownHp: waveOppHp,
        enemyHp: wavePlayerHp,
        maxHp: opponentMaxHealth,
      });
      waveOpp = arrival.ownField;
      wavePlayer = arrival.enemyField;
      waveOppHp = arrival.ownHp;
      wavePlayerHp = arrival.enemyHp;
      if (arrival.damageToEnemy) battleStatsRef.current.damageTaken += arrival.damageToEnemy;
      arrival.logs.forEach(addToBattleLog);
    }
    opponentSide = { ...opponentSide, health: waveOppHp, field: waveOpp };
    if (plays.length > 0) {
      setOpponentDeck(opponentSide.deck);
      setOpponentField(waveOpp);
      setPlayerField(wavePlayer);
      if (waveOppHp !== opponentHealth) setOpponentHealth(waveOppHp);
      if (wavePlayerHp !== playerHealth) setPlayerHealth(wavePlayerHp);
      playSound('cardPlay');
      plays.forEach(c => {
        addToBattleLog(fillLine(boardLine('chuckPlays'), { card: c.name }));
        noteHouse('b', { t: 'play', c: c.id });
      });
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
      let livePlayerField = wavePlayer;
      let faceDamage = 0;
      let trapDamageToOpponent = 0;
      let killedPlayerCreature = false;
      const logs = [];
      const hungoverSwung = [];
      const interestHits = new Map();
      // The wave's combat feedback, fired together once it has resolved —
      // before the write-back below, while every card it names (the dead
      // included) is still on screen to be measured.
      const waveFx = [];

      // Aura field for royal: the pre-existing board PLUS what was just played,
      // so a royal the opponent dropped this turn buffs its other attackers.
      // Quickies played this turn join the wave; other arrivals stay sick.
      const auraField = waveOpp;
      const swingers = orderAttackers({
        difficulty: dealtDifficultyRef.current,
        attackers: waveOpp.filter(canAttack),
        attackerField: auraField,
        enemyField: livePlayerField,
      });

      swingers.forEach(card => {
        // Creature blockers (taunt/protect/normal) must be dealt with first.
        const targets = getValidTargets(opponentField, livePlayerField);

        if (targets.length > 0) {
          // Easy swings at the smallest threat. Normal and Hard take a kill
          // when one is there. Resolve against HP the way the player does.
          const target = card.ability === 'blackout'
            ? pickBlackoutTarget(targets)
            : planAttackTarget({
              difficulty: dealtDifficultyRef.current,
              attacker: card,
              targets,
              attackerField: auraField,
            });
          if (card.ability === 'hungover') hungoverSwung.push(card.instanceId);
          const { survivor, overkill, dmg } = resolveCreatureHit(card, target, auraField, houseRule.damage || 0, { health: opponentSide.health });
          const impact = classifyHit({ dmg, killed: !survivor, overkill });
          const flavor = hitFlavor({ dmg, killed: !survivor, overkill });
          const mark = (event) => withImpact(flavor ? { ...event, flavor } : event, impact);
          playSound('attack');
          const taken = survivor ? dmg : dmg - overkill;
          waveFx.push({ card: card.instanceId, strike: true });
          if (taken > 0) waveFx.push(mark({ card: target.instanceId, hit: true, tone: 'damage', text: `−${taken}` }));
          if (!survivor && overkill > 0) waveFx.push(mark({ face: 'player', hit: true, tone: 'damage', text: `−${overkill}` }));
          if (survivor) {
            livePlayerField = livePlayerField.map(c => c.instanceId === target.instanceId ? survivor : c);
            if (target.ability === 'fury') {
              logs.push(gainedFuryStack(target, survivor)
                ? `${target.name} is FURIOUS now! +1 attack`
                : `${target.name} is capped out at +3 fury — poke away.`);
            }
            logs.push(fillLine(boardLine('oppHit'), { attacker: card.name, target: target.name, dmg, hp: survivor.currentHp }));
            if (card.ability === 'cutoff' && survivor.hungover) {
              logs.push(`${card.name} cut ${target.name} off. They can watch the next one.`);
            }
            noteHouse('b', { t: 'hit', c: card.id, g: target.id });
          } else {
            livePlayerField = livePlayerField.filter(c => c.instanceId !== target.instanceId);
            faceDamage += overkill;
            killedPlayerCreature = true;
            logs.push(`${card.name} UNSTUFFED ${target.name}${overkill > 0 ? ` — ${overkill} trampled into your beans` : ''}`);
          }
          const aside = hitAside({
            attacker: card.name, target: target.name, killed: !survivor, overkill, dmg, foe: 'you',
          });
          if (aside) logs.push(aside);
          return;
        }

        // No creature blockers. A Quickie that just arrived stops here: the
        // face, and the trap a face swing would spring, wait a turn.
        if (!canSwingFace(card)) return;
        if (card.ability === 'hungover') hungoverSwung.push(card.instanceId);

        // A player trap springs on the attacker (and is consumed); otherwise
        // the attack hits face.
        const trap = livePlayerField.find(c => c.type === 'trap');
        if (trap) {
          const trapDamage = trap.amount || 3;
          trapDamageToOpponent += trapDamage;
          waveFx.push({ card: card.instanceId, strike: true });
          if (trapDamage > 0) waveFx.push({ face: 'opponent', hit: true, tone: 'damage', text: `−${trapDamage}` });
          livePlayerField = livePlayerField.filter(c => c.instanceId !== trap.instanceId);
          playSound('trap');
          logs.push(`Your ${trap.name} sprang! ${OPPONENT_NAME} ate ${trapDamage} damage. Delicious.`);
          const taxed = applyInterest(card, trap);
          if (taxed.attack !== card.attack) {
            interestHits.set(card.instanceId, taxed.attack);
            logs.push(`${trap.name} takes ${trap.interest} off ${card.name}. The tab collects.`);
          }
        } else {
          // Include a 'royal' ally's aura in the opponent's face damage too, not
          // just its creature-vs-creature hits. Uses auraField so a royal played
          // this turn counts. Mirrors the player-side fix at attackOpponentDirectly.
          const oppFaceDamage = effectiveAttack(card, auraField, { health: opponentSide.health }) + (houseRule.damage || 0);
          const faceKill = oppFaceDamage >= Math.max(0, playerHealth - faceDamage);
          const impact = classifyHit({ dmg: oppFaceDamage, killed: faceKill, overkill: 0 });
          const flavor = hitFlavor({ dmg: oppFaceDamage, killed: faceKill, overkill: 0 });
          faceDamage += oppFaceDamage;
          playSound('attack');
          waveFx.push({ card: card.instanceId, strike: true });
          if (oppFaceDamage > 0) {
            waveFx.push(withImpact({
              face: 'player', hit: true, tone: 'damage', text: `−${oppFaceDamage}`, ...(flavor ? { flavor } : {}),
            }, impact));
          }
          const aside = hitAside({
            attacker: card.name, dmg: oppFaceDamage, killed: faceKill, face: true, foe: 'You',
          });
          if (aside) logs.push(aside);
          logs.push(fillLine(boardLine('oppFace'), { attacker: card.name, dmg: oppFaceDamage }));
          noteHouse('b', { t: 'face', c: card.id });
        }
      });

      pushFx(waveFx);
      setPlayerField(livePlayerField);
      // Chuck's board has now sat through a full round, so everything on it —
      // the opener, and whatever he just slammed down — is settled and free to
      // swing next turn. Done after the wave rather than before it so cards
      // played this turn still sit out the turn they arrived.
      setOpponentField(prev => readyCreatures(prev.map((c) => {
        const attack = interestHits.has(c.instanceId) ? interestHits.get(c.instanceId) : c.attack;
        const next = attack === c.attack ? c : { ...c, attack };
        return hungoverSwung.includes(c.instanceId) ? { ...next, pendingHangover: true } : next;
      })));
      const oppTip = tabTip(opponentSide.field);
      if (oppTip) {
        setOpponentHealth((hp) => Math.min(opponentMaxHealth, hp + oppTip));
        logs.push(`The tab tops ${OPPONENT_NAME} up. +${oppTip} HP.`);
      }
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
        setTurnSlip(emptySlip());
        setTurnCount(prev => prev + 1);
        // turnCount is still the pre-increment value in this closure — use +1
        // so energy tracks the turn the player is about to take.
        const due = barRef.current.playerTab;
        barRef.current.playerTab = 0;
        if (due) {
          setPlayerHealth((hp) => payTab(hp, due).health);
          addToBattleLog('The tab comes due.');
        }
        const nextEnergy = energyAfterCut(
          Math.min(MAX_ENERGY, energyForTurn(turnCount + 1) + (houseRule.energy || 0)),
          barRef.current.playerCut,
        );
        barRef.current.playerCut = 0;
        setPlayerEnergy(nextEnergy);
        setPhase('draw');
        addToBattleLog(boardLine('yourTurn'));
        noteHouse('b', { t: 'end' });
        noteBooth(addToBattleLog, lastBoothRef);
      }, 500);
    }, 1000);
  };

  // Cancel targeting
  const cancelTargeting = () => {
    setSelectedCard(null);
    setTargetingMode(false);
    setAimId(null);
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
    addToBattleLog(boardLine('conceded'));
    setPlayerHealth(0); // routes through the existing defeat flow
  };

  // Restart game with proper state reset
  const restartGame = () => {
    // Cancel any queued opponent-turn steps from the finished game so they can't
    // fire and mutate the fresh board.
    clearAllTimeouts();

    // Reset battle stats ref
    battleStatsRef.current = {
      damageDealt: 0, healingDone: 0, cardsPlayed: 0, damageTaken: 0, fatigueTaken: 0, fatigueDealt: 0,
    };

    // Reset game state. deckReady gates the draw phase until the init effect
    // has dealt the new opening hand.
    setDeckReady(false);
    setMulliganOpen(false);
    setMulliganPicks(new Set());
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
    playerFatigueRef.current = 0;
    opponentFatigueRef.current = 0;
    setPlayerFatigue(0);
    setOpponentFatigue(0);

    // Reset opponent state (initializeGame re-applies the difficulty mod to
    // both of these when the fresh game deals).
    setOpponentHealth(30);
    setOpponentMaxHealth(30);
    setOpponentField([]);
    setOpponentDeck([]);

    // Reset UI state
    setSelectedCard(null);
    setTargetingMode(false);
    setAimId(null);
    setBoardShake(null);
    setTurnSlip(emptySlip());
    setLeaveMode(null);
    setBattleLog([]);
    setFx([]);
    setGameOver(false);
    setWinner(null);
    setShowAbilityPopup(null);
    setBattleRewards(rewardsFrom(null));
    setResultCopy(null);

    // Reset both mouths
    setOppQuip(null);
    setPlayerQuip(null);
    setEndQuip(null);
    lastQuipRef.current = null;
    nearDeathQuippedRef.current = false;

    // The lights go down: a new game is a new night (see lastCallRef).
    setLastCall(false);
    lastCallRef.current = null;
    lastCallBannerEndsRef.current = 0;
    turnBannerEndsRef.current = 0;

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
  const coachStep = firstFightStep({
    armed: coachArmed && !gameOver && !mulliganOpen,
    readyAttacker: playerTurn && playerField.some((card) => canAttack(card)),
  });
  const coachCopy = coachStep ? FIRST_FIGHT[coachStep] : null;
  const coachCardId = (() => {
    if (coachStep === 'attack') return playerField.find((card) => canAttack(card))?.instanceId ?? null;
    if (coachStep === 'warming') {
      return playerField.find((card) => card.summoningSick)?.instanceId
        ?? opponentField.find((card) => card.summoningSick)?.instanceId
        ?? null;
    }
    return null;
  })();

  // The ring is painted on the card, so a scroll moves it with the card.
  // A resize that pushes the card out of its row brings the card back.
  useEffect(() => {
    const root = boardRef.current;
    if (!root || !coachCardId) return undefined;
    const place = () => anchorCoachTarget(root);
    place();
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', place);
      return () => window.removeEventListener('resize', place);
    }
    const ro = new ResizeObserver(place);
    ro.observe(root);
    root.querySelectorAll('[data-coach-scroll]').forEach((el) => ro.observe(el));
    const onScroll = () => place();
    root.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', place);
    return () => {
      ro.disconnect();
      root.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', place);
    };
  }, [coachCardId]);
  // The player's turn proper: their card has arrived, and they can play cards
  // and attack with ready creatures in any order until they end it.
  const playerMove = playerTurn && phase === 'main' && !gameOver;
  const moveState = {
    hand: playerHand, field: playerField, energy: playerEnergy, health: playerHealth,
    maxHealth: PLAYER_MAX_HEALTH, deckSize: playerDeck.length, momentum: playerMomentum,
  };
  // Nothing left worth doing this turn: End Turn becomes the primary action.
  const outOfMoves = playerMove && !hasMoveLeft(moveState);
  const liveAttacker = selectedCard
    ? (playerField.find((c) => c.instanceId === selectedCard.instanceId) || selectedCard)
    : null;
  const faceOpen = targetingMode && getValidTargets(playerField, opponentField).length === 0;
  const directTargets = faceOpen && (!liveAttacker || canSwingFace(liveAttacker));
  const strike = targetingMode && liveAttacker
    ? strikePrompt({
      attacker: liveAttacker,
      attackerField: playerField,
      defenderField: opponentField,
      focusId: aimId,
      foeName: OPPONENT_NAME,
      health: playerHealth,
    })
    : null;
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
  // The same measurement is what the card preview is placed by (see
  // previewPlacement.js): the felt's box, the centre line, and the rows'
  // size at their zoom.
  const [fieldZoom, setFieldZoom] = useState(1);
  const [feltGeom, setFeltGeom] = useState(null);
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
    const geom = {
      width: felt.clientWidth,
      height: felt.clientHeight,
      pad: { top: px(cs.paddingTop), right: px(cs.paddingRight), bottom: px(cs.paddingBottom), left: px(cs.paddingLeft) },
      gap: px(cs.rowGap),
      centre: { top: centre.offsetTop, bottom: centre.offsetTop + centre.offsetHeight },
      rowH: FIELD_ROW_HEIGHT * zoom,
      rowW: rowWidth * zoom,
    };
    setFeltGeom((g) => (g && JSON.stringify(g) === JSON.stringify(geom) ? g : geom));
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

  // The focus a keyboard move left behind (see refocusRef), once the board
  // has re-rendered: the card now in a played card's place, else End Turn;
  // after an attack the next ready attacker, else End Turn; after Cancel the
  // attacker it let go of; after End Turn, Rally or Play Again, End Turn —
  // once it is there, on the player's turn. Only when the focus really has
  // been lost (to the page, an inert card on its way out, or a card that is
  // no longer a control): a player who has moved on keeps their place.
  useEffect(() => {
    const want = refocusRef.current;
    if (!want) return;
    if (gameOver) {
      refocusRef.current = null;
      return;
    }
    // A wait for End Turn decides once End Turn is back, not before.
    if (want.kind === 'turn' && (currentTurn !== 'player' || phase !== 'main' || !endTurnRef.current)) return;
    // `from` is a control on its way out (Play Again leaves with its panel),
    // so the focus still on it counts as lost.
    const active = document.activeElement;
    const lost = !active || active === document.body || !active.isConnected || active === want.from
      || Boolean(active.closest('[inert]')) || !active.matches(TABBABLE);
    if (!lost) {
      refocusRef.current = null;
      return;
    }
    const endTurnButton = endTurnRef.current;
    let target = null;
    if (want.kind === 'turn') {
      target = endTurnButton;
    } else if (want.kind === 'hand') {
      const cards = [...(handScrollerRef.current?.querySelectorAll('[data-hand-id][role="button"]:not([inert])') ?? [])];
      target = cards[Math.min(want.index, cards.length - 1)] ?? endTurnButton;
    } else if (want.kind === 'attack') {
      target = feltRef.current?.querySelector('[data-field="player"][role="button"]:not([inert])') ?? endTurnButton;
    } else if (want.kind === 'select') {
      target = feltRef.current?.querySelector(`[data-card-id="${want.id}"][role="button"]`) ?? endTurnButton;
    }
    refocusRef.current = null;
    target?.focus();
  }, [playerHand, playerField, currentTurn, phase, targetingMode, gameOver]);

  // Reading a card: the enlarged preview (CardPreview). `preview` is
  // { id, from, via, anchor }: the card (from 'hand', 'player' or
  // 'opponent'), what opened it — 'hover' (a mouse resting on it), 'focus'
  // (the keyboard landing on it), 'hold' (a finger held on a table card) or
  // 'key' (I, below) — and the row it must keep clear (previewPlacement.js).
  // `raisedId` is the hand card a first tap raised on a touch screen — there
  // the first tap inspects and the second plays, because overlapped cards
  // hide their cost coins and a tap that played at once left no way to read
  // a card before committing it. A mouse click, Enter and Space still play at
  // once, and the control's name is still "Play <name>".
  const [preview, setPreview] = useState(null);
  const [raisedId, setRaisedId] = useState(null);
  const previewTimerRef = useRef(null);
  const hideTimerRef = useRef(null);
  // Whether a preview is on screen right now, for the hover's delay.
  const previewShownRef = useRef(false);
  // The last press: its pointer type and the card it landed on.
  const lastPointerRef = useRef({ type: 'mouse', id: null });
  const longPressRef = useRef({ timer: null, fired: false, x: 0, y: 0 });
  useEffect(() => () => {
    clearTimeout(previewTimerRef.current);
    clearTimeout(hideTimerRef.current);
    clearTimeout(longPressRef.current.timer);
  }, []);
  const showPreview = useCallback((p, delay = 0) => {
    clearTimeout(previewTimerRef.current);
    clearTimeout(hideTimerRef.current);
    if (delay) previewTimerRef.current = setTimeout(() => setPreview(p), delay);
    else setPreview(p);
  }, []);
  // Take the preview down if it is showing card `id` (any card, without one)
  // and `keep` does not claim it.
  const hidePreview = useCallback((id, keep = () => false) => {
    clearTimeout(previewTimerRef.current);
    clearTimeout(hideTimerRef.current);
    setPreview((cur) => (cur && (id == null || cur.id === id) && !keep(cur) ? null : cur));
  }, []);
  // A mouse leaving a card gets a moment to reach the preview, which then
  // stays for as long as the pointer is on it (WCAG 1.4.13: what hovering
  // shows can itself be hovered — a magnifier user has to move there to
  // read it). Only a hover preview goes this way; the keyboard's stays.
  const hideAfterHover = useCallback((id) => {
    clearTimeout(previewTimerRef.current);
    clearTimeout(hideTimerRef.current);
    hideTimerRef.current = setTimeout(() => {
      setPreview((cur) => (cur && cur.id === id && cur.via === 'hover' ? null : cur));
    }, PREVIEW_HOVER_GRACE_MS);
  }, []);
  const keepPreview = useCallback(() => clearTimeout(hideTimerRef.current), []);
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
    if (gameOver || leaveMode) {
      clearTimeout(previewTimerRef.current);
      setRaisedId(null);
      setPreview(null);
    }
  }, [gameOver, leaveMode]);

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
            showPreview({ ...p, via: 'hold', anchor: p.from });
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
      // The first card a mouse rests on waits PREVIEW_HOVER_MS; moving on to
      // the next while one is open swaps at once, as a row of tooltips does.
      onPointerEnter: (e) => {
        if (e.pointerType !== 'mouse') return;
        // While an attacker is picked, a card on your own side opens no hover
        // preview: below ~900px it would open over Chuck's row, on the very
        // targets, and swallow the click meant for one.
        if (targetingMode && p.from === 'player') return;
        showPreview({ ...p, via: 'hover', anchor: p.from }, previewShownRef.current ? 0 : PREVIEW_HOVER_MS);
      },
      onPointerLeave: (e) => { if (e.pointerType === 'mouse') hideAfterHover(p.id); },
      // Keyboard focus only: a click focuses a card too, and the preview
      // would then outstay the mouse.
      onFocus: (e) => {
        let keyboard = false;
        try { keyboard = e.target === e.currentTarget && e.target.matches(':focus-visible'); } catch { /* old engine */ }
        if (keyboard) showPreview({ ...p, via: 'focus', anchor: p.from });
      },
      onBlur: () => hidePreview(p.id, (cur) => cur.via === 'hover'),
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
  const finishMulligan = (ids) => {
    if (!mulliganOpen) return;
    const next = applyMulligan(playerHand, playerDeck, ids);
    setPlayerHand(next.hand);
    setPlayerDeck(next.deck);
    setMulliganOpen(false);
    setMulliganPicks(new Set());
    addToBattleLog(next.drawn ? mulliganSwapLine(next.drawn) : mulliganKeptLine());
    setDeckReady(true);
  };

  const pressHandCard = (card, playable, index) => (e) => {
    if (mulliganOpen) {
      setMulliganPicks((prev) => {
        const next = new Set(prev);
        if (next.has(card.instanceId)) next.delete(card.instanceId);
        else next.add(card.instanceId);
        return next;
      });
      return;
    }
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
    // Played from the keys, the card's slot goes inert on its way out and
    // the focus would fall to the page: it moves on to the card now in its
    // place (see refocusRef).
    if (playable && playCard(card) && viaKeys(e)) refocusRef.current = { kind: 'hand', index };
  };

  // The card the preview shows, looked up live, so a card that has just been
  // played or has died takes its preview with it.
  const raisedInHand = raisedId != null && playerHand.some((c) => c.instanceId === raisedId);
  const previewTarget = raisedInHand
    ? { id: raisedId, from: 'hand', via: 'raise', anchor: 'hand' }
    : preview;
  const previewPool = { hand: playerHand, player: playerField, opponent: opponentField };
  const previewCard = previewTarget && !gameOver && !leaveMode
    ? previewPool[previewTarget.from]?.find((c) => c.instanceId === previewTarget.id) ?? null
    : null;
  const previewRules = previewCard?.ability && previewCard.ability !== 'none' ? abilityRules(previewCard.ability) : '';
  // A preview the keyboard opened says which keys drive it.
  const previewKeys = previewTarget?.via === 'focus' || previewTarget?.via === 'key';
  // What goes with the card, in words, so the placement can count the room it
  // takes (previewPlacement.captionHeight): its rules, its flavor line and the
  // keys. The flavor line is shown only where the placement found the room.
  const previewCaption = previewCard
    ? { rules: previewRules, flavor: previewCard.description ?? '', keys: previewKeys }
    : null;
  const previewPlacement = previewCard && feltGeom
    ? placePreview(
      feltGeom,
      previewTarget.anchor ?? previewTarget.from,
      previewCaption.rules || previewCaption.flavor || previewCaption.keys ? previewCaption : false,
    )
    : null;
  const previewShown = Boolean(previewPlacement && previewPlacement.zoom > 0);
  previewShownRef.current = previewShown;

  // Escape takes the preview down, however it was opened, and it stays down
  // until something opens it again: focus moving, the mouse coming back,
  // I. On document, because a hover preview may be up with focus nowhere.
  // A dialog over the board owns Escape (useDialog), so the preview leaves
  // it alone then.
  useEffect(() => {
    if (!previewShown) return undefined;
    const onKey = (e) => {
      if (e.key !== 'Escape' || e.defaultPrevented) return;
      if (document.querySelector('[aria-modal="true"]')) return;
      e.preventDefault();
      clearTimeout(previewTimerRef.current);
      clearTimeout(hideTimerRef.current);
      setPreview(null);
      setRaisedId(null);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [previewShown]);

  // I reads the cards from the keyboard: the focused card first (or the
  // first on the table), then each card in turn — Chuck's row, yours, your
  // hand — and Shift+I goes back. Focus alone only ever reached the cards
  // with a tab stop, so a keyboard player could not read Chuck's cards
  // outside targeting, a creature warming up, or the hand on Chuck's turn,
  // all of which a mouse or a finger can. Only while focus is on the board
  // (the key is handled on its root), never in a dialog over it, and the
  // preview keeps clear of the focused card's row.
  const readingOrder = [
    ...opponentField.map((c) => ({ id: c.instanceId, from: 'opponent' })),
    ...playerField.map((c) => ({ id: c.instanceId, from: 'player' })),
    ...playerHand.map((c) => ({ id: c.instanceId, from: 'hand' })),
  ];
  const onBoardKeyDown = (e) => {
    if ((e.key !== 'i' && e.key !== 'I') || e.ctrlKey || e.metaKey || e.altKey) return;
    if (gameOver || leaveMode || !(e.target instanceof Element) || e.target.closest('[role="dialog"]')) return;
    if (readingOrder.length === 0) return;
    e.preventDefault();
    const focusedRow = e.target.closest('[data-field]')?.getAttribute('data-field') ?? null;
    const focusedId = e.target.closest('[data-card-id]')?.getAttribute('data-card-id')
      ?? e.target.closest('[data-hand-id]')?.getAttribute('data-hand-id');
    const at = previewShown ? readingOrder.findIndex((c) => c.id === previewTarget.id) : -1;
    const next = at === -1
      ? readingOrder.find((c) => String(c.id) === focusedId) ?? readingOrder[0]
      : readingOrder[(at + (e.shiftKey ? -1 : 1) + readingOrder.length) % readingOrder.length];
    setRaisedId(null);
    showPreview({ ...next, via: 'key', anchor: focusedRow ?? next.from });
  };
  // A preview I opened belongs to where focus was: once focus moves, it goes
  // (a card that takes focus opens its own straight after).
  const onBoardFocus = () => setPreview((cur) => (cur?.via === 'key' ? null : cur));

  return (
    // Exactly the viewport's height on touch screens. With a mouse it never
    // goes below 640px and the page scrolls instead: zooming the browser in
    // shrinks the CSS viewport, and a board fitted to it would answer by
    // making the cards smaller — the opposite of what zooming in asked for.
    // (The height must stay definite either way; the felt's fit is measured
    // from it.)
    <div
      className="game-surface relative w-full h-[100dvh] [@media(pointer:fine)]:h-[max(100dvh,40rem)] bar-backdrop overflow-hidden"
      ref={boardRef}
      data-last-call={lastCall ? '' : undefined}
      onKeyDown={onBoardKeyDown}
      onFocus={onBoardFocus}
    >
      <FxContext.Provider value={fx}>
      {/* The screen's heading, for a screen reader and for App, which puts
          the focus here when the battle opens (the tile that opened it is
          gone by then). The table says it visually. */}
      <h1 className="sr-only">Battle against {brawl?.rivalName || OPPONENT_NAME}</h1>
      <div className="absolute inset-0 grain pointer-events-none" aria-hidden="true" />
      {/* The house lights: last call's cold wash over the room, under all
          the content beside the grain, so no text sits under it (index.css,
          .house-lights; the lamp over the felt is a layer of the felt's own).
          Unlit until data-last-call is set on the board. */}
      <div className="house-lights absolute inset-0 z-0 pointer-events-none" aria-hidden="true" />
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
        <p className="text-sm text-plush-200 max-w-xs">The table needs more height than a sideways phone has. {OPPONENT_NAME} will wait.</p>
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
              ref={resultPanelRef}
              initial={{ scale: 0.85, y: 30 }}
              animate={{ scale: 1, y: 0 }}
              // useDialog focused Play Again as the panel arrived at 85% of its
              // size, and the scroll that focus did was for a panel that is
              // shorter than the one that has just settled: on a screen the
              // Tab makes it taller than, the button was left half below the
              // fold. Once the panel is its own size, bring it back into view
              // (a no-op where it already is). A frame on, because with
              // reduced motion the panel reaches its size on the frame after
              // this callback.
              onAnimationComplete={() => requestAnimationFrame(() => {
                resultPanelRef.current?.querySelector('[data-autofocus]')?.scrollIntoView?.({ block: 'nearest' });
              })}
              className={`relative my-auto rounded-2xl px-6 py-7 [@media(max-height:880px)]:py-5 sm:px-8 text-center max-w-md w-full overflow-hidden dialog-panel ${won ? 'trim-brass' : ''}`}
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
                className="relative mx-auto mb-4 h-20 w-20 rounded-full p-[3px] [@media(max-height:880px)]:mb-3 [@media(max-height:880px)]:h-16 [@media(max-height:880px)]:w-16"
                style={{ background: won ? RARITY_METAL.legendary : RARITY_METAL.common }}
                aria-hidden="true"
              >
                <div className="flex h-full w-full items-center justify-center rounded-full bg-night-900">
                  {won
                    ? <Trophy className="h-9 w-9 text-brass-300" strokeWidth={1.75} />
                    : <HeartCrack className="h-9 w-9 text-plush-300" strokeWidth={1.75} />}
                </div>
              </motion.div>
              {/* The headline and the line under it come from the tables in
                  resultLines.js, picked once when the game ended (resultCopy).
                  The first of each stands in for the instant before that. */}
              <h2 className={`relative text-balance font-display text-3xl sm:text-4xl font-extrabold leading-tight mb-2 ${won ? 'text-brass-gradient' : 'text-plush-100'}`}>
                {resultCopy?.title ?? RESULT_TITLES[won ? 'win' : 'loss'][0]}
              </h2>
              <p className="relative mb-2 text-balance text-plush-200">
                {resultCopy?.subline ?? RESULT_SUBLINES[won ? 'win' : 'loss'][0]}
              </p>
              {endQuip && (
                <p className="relative mb-5 text-sm italic text-plush-300">
                  🧸 {OPPONENT_NAME}: “{endQuip}”
                </p>
              )}

              {/* The Tab: what the battle paid, printed as a bar tab. The
                  night itemized, then XP and coins, the level's progress, a
                  level-up and its bonus coins when there is one, and a Battle
                  Pass tier the XP opened, then Chuck's running bill and a
                  footer (BarTab.jsx). It used to be two chips and a bar,
                  while a level-up paid 100 x the new level in coins without a
                  word. */}
              <NightSlip mvp={mvp} recap={recap} onWatch={replayId ? () => openReplay({ id: replayId }) : null} />
              <BarTab rewards={battleRewards} footer={resultCopy?.footer} />
              {/* Upsell nudge — only shown when player is low on resources */}
              {(cardPacks === 0 || gems < 50) && (onOpenShop || onBackToMenu) && (
                <motion.div
                  initial={reducedMotion ? false : { opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.8 }}
                  className="relative mb-5 rounded-xl bg-black/25 ring-1 ring-white/5 p-3"
                >
                  <p className="text-sm mb-2 text-plush-200">
                    {cardPacks === 0 ? 'Out of packs. The Shop keeps a few under the counter. Ask nicely.' : 'Low on gems. The Shop is open all night. Chuck says broke is a personality. Chuck would know.'}
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

              {brawl && (
                <div className="relative mb-4">
                  <p className="mb-3 text-sm text-plush-200">The ladder takes the finish. The till keeps its hands to itself.</p>
                  <p className="label-caps mb-2 text-plush-300">Leave them a line</p>
                  <div className="grid grid-cols-2 gap-2">
                    {TAUNTS.map((taunt) => (
                      <button
                        key={taunt.id}
                        type="button"
                        aria-pressed={tauntPick === taunt.id}
                        onClick={() => { tauntRef.current = taunt.id; setTauntPick(taunt.id); }}
                        className={`btn-glass h-11 rounded-xl px-2 text-sm font-bold ${FOCUS_OUTLINE} ${tauntPick === taunt.id ? 'border-2 border-brass-300' : ''}`}
                      >
                        {taunt.short}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <div className="relative flex gap-3 justify-center">
                {/* The dialog's first focus (useDialog's data-autofocus), so
                    Enter plays again. The upsell above comes first in the
                    DOM, and it used to take the focus for every player low
                    on gems or packs: Enter left the battle for the Shop.
                    Pressed from the keys, the focus goes on to the new game's
                    End Turn: this button goes with the panel, and the focus
                    went to the page. A ladder ticket is one result, so it
                    has no Play Again: Menu takes the focus instead. */}
                {!brawl && (
                  <button
                    type="button"
                    data-autofocus=""
                    onClick={(e) => {
                      if (viaKeys(e)) refocusRef.current = { kind: 'turn', from: e.currentTarget };
                      restartGame();
                    }}
                    className={`${ACTION} btn-brass min-w-[8rem]`}
                  >
                    Play Again
                  </button>
                )}
                {onBackToMenu && (
                  <button type="button" data-autofocus={brawl ? '' : undefined} onClick={onBackToMenu} className={`${ACTION} btn-glass min-w-[6rem]`}>
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
              <div className="font-display font-extrabold text-white leading-tight truncate max-w-[7rem] sm:max-w-none">{brawl?.rivalName || OPPONENT_NAME}</div>
              {daily && (
                <div data-daily="" className="truncate text-[11px] font-semibold text-brass-200 max-w-[8rem] sm:max-w-none">{daily.modifier.name}</div>
              )}
              <div className="text-red-200/80 text-[11px] whitespace-nowrap">
                Deck: {opponentDeck.length}
                {opponentDeck.length === 0 && (
                  <span className="text-brass-200" data-fatigue="opponent"> · next {opponentFatigue + 1}</span>
                )}
              </div>
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
              data-shake={boardShake || undefined}
              className="felt-table felt-print stitched relative h-full rounded-[15px] grid grid-cols-[minmax(0,1fr)] grid-rows-[minmax(0,1fr)_auto_minmax(0,1fr)] gap-3 px-2 py-3 sm:p-4"
            >
              {/* The lamp over the felt, brightened by last call. Absolute,
                  so it takes no place in the grid (and fitField's
                  measurement of the felt is untouched), and under the cards
                  and text like the print on the cloth (z -1 in the felt's own
                  stacking context). */}
              <div className="felt-lamp" aria-hidden="true" />
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
              <div data-coach-scroll="" className="self-center flex justify-center items-start gap-2 sm:gap-3" style={{ zoom: fieldZoom }}>
                {/* Keyed by game: Play Again remounts the row, rather than
                    playing the last game's cards out as if they had died. */}
                <AnimatePresence key={gameId}>
                {opponentField.map((card) => {
                  const validTargets = getValidTargets(playerField, opponentField);
                  const isValidTarget = validTargets.find(t => t.instanceId === card.instanceId);
                  const hittable = targetingMode && isValidTarget;
                  const press = {
                    ...describedPress(
                      pressable((e) => attackTarget(card, e), `Attack ${card.name}`, targetingMode),
                      `desc-field-${card.instanceId}`,
                    ),
                    ...(hittable ? {
                      onPointerEnter: () => setAimId(card.instanceId),
                      onPointerLeave: () => setAimId((id) => (id === card.instanceId ? null : id)),
                    } : {}),
                  };

                  return (
                    <FieldSlot
                      key={card.instanceId}
                      cardId={card.instanceId}
                      side="opponent"
                      initial={{ y: -40, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      data-field="opponent"
                      data-coach-target={coachCardId === card.instanceId ? '' : undefined}
                      className={`relative rounded-[10px] ${FOCUS_OUTLINE} ${hittable ? 'cursor-crosshair' : ''}`}
                      press={press}
                      {...inspectHandlers({ id: card.instanceId, from: 'opponent' }, { hold: 'preview' })}
                    >
                      <div
                        data-target-ring={hittable ? '' : undefined}
                        className={`relative rounded-[10px] transition-shadow ${hittable
                          ? 'ring-2 ring-red-400 shadow-[0_0_22px_4px_rgba(248,113,113,0.55)]'
                          : coachCardId === card.instanceId
                            ? 'ring-2 ring-brass-300 shadow-[0_0_18px_2px_rgba(251,191,36,0.55)]'
                            : ''}`}
                      >
                        {/* Only the card dims for stealth; the band and tags
                            stay at full strength so they keep their contrast.
                            The face is said in words (CardWords). */}
                        <div aria-hidden="true" className={card.stealthActive ? 'opacity-50' : ''}>
                          <TeddyCard
                            teddy={card}
                            lift={false}
                            wearRing={false}
                            variant="board"
                            side="opponent"
                            tauntActive={card.ability === 'taunt' && !card.stealthActive}
                            attackDelta={effectiveAttack(card, opponentField, { health: opponentHealth }) - card.attack}
                            raisedNote={attackAuraNote(card, opponentField) || 'a Royal ally'}
                            nameless={fieldZoom < NAMELESS_BELOW}
                            zoom={fieldZoom}
                          />
                        </div>
                        {card.stealthActive && <StealthBand zoom={fieldZoom} />}
                        {/* Tells the player which of Chuck's teddies can
                            actually swing at them next turn — without it,
                            summoning sickness is only legible on their own
                            half of the table. */}
                        {card.hungover && <StatusChip zoom={fieldZoom}>Hungover</StatusChip>}
                        {card.summoningSick && !card.hungover && (
                          <StatusChip zoom={fieldZoom} marked={coachCardId === card.instanceId && coachStep === 'warming'}>{arrivalChip(card)}</StatusChip>
                        )}
                        <CardWords id={`desc-field-${card.instanceId}`} card={card} press={press}>
                          {describeCard(card, { attack: effectiveAttack(card, opponentField, { health: opponentHealth }), aura: attackAuraNote(card, opponentField, { health: opponentHealth }) })}
                        </CardWords>
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
                    onPointerEnter={() => setAimId('face')}
                    onPointerLeave={() => setAimId((id) => (id === 'face' ? null : id))}
                    onFocus={() => setAimId('face')}
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
                    data-turn-plaque=""
                    className={`shrink-0 rounded-lg px-3 sm:px-4 py-1 font-display font-extrabold text-sm sm:text-base whitespace-nowrap shadow-[inset_0_1px_0_rgba(255,255,255,0.45),0_6px_14px_-6px_rgba(0,0,0,0.8)] ${playerTurn ? 'text-night-950' : 'text-white'} ${banner ? 'invisible' : ''}`}
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
                    <div
                      data-strike-preview=""
                      className="relative flex max-w-full items-center gap-1.5 rounded-full bg-red-950/90 px-3 py-1 text-xs font-bold text-red-100"
                    >
                      {/* The ring pulses, not the text, so the prompt keeps its
                          contrast at every point of the pulse. */}
                      <span className="absolute inset-0 rounded-full ring-1 ring-red-400/70 motion-safe:animate-pulse" aria-hidden="true" />
                      <Crosshair className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                      <span className="truncate">
                        Pick a victim for {selectedCard?.name}{strike?.tail ? ` · ${strike.tail}` : ''}
                      </span>
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
                      className={`xl:hidden max-w-full line-clamp-2 break-words rounded-2xl px-3 py-0.5 text-center text-xs leading-[14px] font-semibold text-night-900 pointer-events-none ${banner ? 'invisible' : ''} ${speech.who === 'opponent'
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
                      className={`md:hidden max-w-full truncate rounded-full bg-night-950/80 ring-1 ring-white/5 px-3 py-1 text-xs text-plush-200 pointer-events-none ${banner ? 'invisible' : ''}`}
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
              <div data-coach-scroll="" className="self-center flex justify-center items-start gap-2 sm:gap-3" style={{ zoom: fieldZoom }}>
                <AnimatePresence key={gameId}>
                {playerField.map((card) => {
                  const selected = selectedCard?.instanceId === card.instanceId;
                  // A ready creature is an attacker the player can pick at
                  // any point in their turn; nothing else on their side is.
                  const ready = playerMove && canAttack(card);
                  const resting = card.type === 'action' && !canAttack(card);
                  /* Only a ready creature is a button: a warming-up or spent
                     one, or a trap, would be a "Select … to attack" that
                     cannot attack, and its chip ("Warming Up", "Exhausted")
                     already says why. A tap on one still reaches
                     selectCardForAttack, which owns the rejection messages,
                     so a pointer player who tries is told the rule rather
                     than met with silence. */
                  const press = ready
                    ? describedPress(pressable(() => selectCardForAttack(card), `Select ${card.name} to attack`), `desc-field-${card.instanceId}`)
                    : (playerMove ? { onClick: () => selectCardForAttack(card) } : {});
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
                      press={press}
                      data-field="player"
                      data-coach-target={coachCardId === card.instanceId ? '' : undefined}
                      {...inspectHandlers({ id: card.instanceId, from: 'player' }, { hold: 'preview' })}
                    >
                      <div
                        data-target-ring={selected || ready ? '' : undefined}
                        className={`relative rounded-[10px] transition-shadow ${selected
                          ? 'ring-2 ring-brass-300 shadow-[0_0_24px_4px_rgba(251,191,36,0.55)]'
                          : coachCardId === card.instanceId
                            ? 'ring-2 ring-brass-300 shadow-[0_0_18px_2px_rgba(251,191,36,0.55)]'
                            : ready ? 'shadow-[0_0_18px_2px_rgba(52,211,153,0.5)]' : ''}`}
                      >
                        {/* Resting dims the art alone: the Taunt frame, the
                            name and the stats keep their strength. The face
                            is said in words (CardWords). */}
                        <div aria-hidden="true">
                          <TeddyCard
                            teddy={card}
                            cosmeticBorder={cosmeticBorder}
                            lift={false}
                            variant="board"
                            side="player"
                            resting={resting}
                            tauntActive={card.ability === 'taunt' && !card.stealthActive}
                            attackDelta={effectiveAttack(card, playerField, { health: playerHealth }) - card.attack}
                            raisedNote={attackAuraNote(card, playerField) || 'a Royal ally'}
                            nameless={fieldZoom < NAMELESS_BELOW}
                            zoom={fieldZoom}
                          />
                        </div>
                        {card.stealthActive && <StealthBand zoom={fieldZoom} />}
                        {card.hungover && <StatusChip zoom={fieldZoom}>Hungover</StatusChip>}
                        {card.hasAttacked && !card.hungover && <StatusChip zoom={fieldZoom}>Exhausted</StatusChip>}
                        {card.summoningSick && !card.hasAttacked && !card.hungover && (
                          <StatusChip zoom={fieldZoom} marked={coachCardId === card.instanceId && coachStep === 'warming'}>{arrivalChip(card)}</StatusChip>
                        )}
                        <CardWords id={`desc-field-${card.instanceId}`} card={card} press={press}>
                          {describeCard(card, { attack: effectiveAttack(card, playerField, { health: playerHealth }), aura: attackAuraNote(card, playerField, { health: playerHealth }) })}
                        </CardWords>
                      </div>
                    </FieldSlot>
                  );
                })}
                </AnimatePresence>
              </div>

              {/* The banner (see its effect): a turn's, or last call's. Over
                  the centre line, which is empty of controls at a turn
                  boundary. Last call's is plain cold white: no colour of
                  the board's (brass for you, red for Chuck) is its. */}
              {banner && (
                <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-1/2 z-30 flex -translate-y-1/2 justify-center">
                  <div
                    key={banner.id}
                    data-banner={banner.lastCall ? 'last-call' : 'turn'}
                    className={`fx-banner rounded-xl px-8 py-2.5 font-display text-3xl font-extrabold tracking-tight shadow-[0_18px_40px_-14px_rgba(0,0,0,0.9)] sm:text-4xl ${banner.lastCall
                      ? 'bg-night-950/90 ring-1 ring-plush-100/40'
                      : banner.turn === 'player'
                        ? 'bg-night-950/90 ring-1 ring-brass-300/50'
                        : 'bg-night-950/90 ring-1 ring-red-400/50'}`}
                  >
                    {banner.lastCall
                      ? <span className="text-plush-100">{LAST_CALL_BANNER}</span>
                      : banner.turn === 'player'
                        ? <span className="text-brass-gradient">{banner.text}</span>
                        : <span className="text-red-300">{banner.text}</span>}
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
                    data-ability-callout=""
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
              {previewShown && (
                <CardPreview
                  card={previewCard}
                  placement={previewPlacement}
                  rules={previewPlacement.kept.rules ? previewRules : ''}
                  flavor={previewPlacement.kept.flavor ? previewCaption.flavor : ''}
                  keys={previewPlacement.kept.keys && previewKeys}
                  hoverable={previewTarget.via === 'hover'}
                  onKeep={keepPreview}
                  onDismiss={() => hidePreview()}
                  costDelta={previewTarget.from === 'hand' ? effectiveCost(previewCard, playerField) - previewCard.cost : 0}
                  // A hand card is not on the table yet, so no aura reaches it.
                  attackDelta={previewTarget.from === 'hand'
                    ? 0
                    : effectiveAttack(previewCard, previewTarget.from === 'player' ? playerField : opponentField, { health: previewTarget.from === 'player' ? playerHealth : opponentHealth }) - previewCard.attack}
                  raisedNote={previewTarget.from === 'hand'
                    ? 'a Royal ally'
                    : (attackAuraNote(previewCard, previewTarget.from === 'player' ? playerField : opponentField) || 'a Royal ally')}
                  cosmeticBorder={previewTarget.from === 'opponent' ? null : cosmeticBorder}
                  wearRing={previewTarget.from !== 'opponent'}
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
                    // Named as the pass sells it ("Trash Talk emote"), not by its save key.
                    aria-label={cosmeticLong(emote.name)}
                    title={cosmeticLong(emote.name)}
                    className={`btn-glass flex-none grid place-items-center h-11 w-11 rounded-xl text-lg ${FOCUS_OUTLINE}`}
                  >
                    {emote.icon}
                  </button>
                ))}
              </div>
            )}

            {/* Phone log. The centre line gives its spot to a quip, so the
                record itself is this panel: it stays while Chuck is talking,
                and it is one tap, not a replacement for the line. */}
            {logOpen && (
              <div
                id="battle-log-phone"
                className="md:hidden max-h-36 overflow-y-auto panel-glass rounded-xl p-2"
              >
                {[...battleLog].reverse().map((entry, i) => (
                  <div
                    key={entry.id}
                    className={`text-xs leading-snug py-1.5 border-b border-white/[0.06] last:border-0 ${i === 0 ? 'font-semibold text-plush-100' : 'text-plush-300'}`}
                  >
                    {entry.message}
                  </div>
                ))}
              </div>
            )}

            {/* Game controls. The line keeps its height on Chuck's turn, when
                the buttons are gone: below md the table's height depends on
                it, and an empty line made the whole table grow and shrink at
                every turn boundary. Concede is icon-only on phones, to keep
                the line short enough not to wrap. */}
            {mulliganOpen && (
              <p data-mulligan="" className="text-center text-xs font-semibold text-plush-100">
                Opening hand. Throw any back. Once.
              </p>
            )}
            <p data-turn-slip="" className="max-w-full truncate px-2 text-center text-[11px] leading-4 text-plush-200">
              {slipLine(turnSlip)}
            </p>
            <div role="group" aria-label="Battle actions" className="flex min-h-11 flex-row flex-wrap items-center justify-center gap-2 md:flex-col md:items-stretch">
              <button
                type="button"
                className={`${ACTION} btn-glass md:hidden h-11 w-11 !px-0`}
                aria-expanded={logOpen}
                aria-controls="battle-log-phone"
                aria-label={logOpen ? 'Hide battle log' : 'Battle log'}
                onClick={() => setLogOpen((open) => !open)}
              >
                <ScrollText className="h-4 w-4" aria-hidden="true" />
              </button>
              {!gameOver && !playerTurn && (
                <span className="text-xs italic text-plush-300" aria-hidden="true">
                  {thinkingLine}
                </span>
              )}
              {targetingMode && (
                <button
                  type="button"
                  className={`${ACTION} btn-glass`}
                  onClick={(e) => {
                    if (viaKeys(e) && selectedCard) refocusRef.current = { kind: 'select', id: selectedCard.instanceId };
                    cancelTargeting();
                  }}
                >
                  Cancel
                </button>
              )}
              {/* Only with a teddy to rally (canRally): with none, a full
                  gauge would buy nothing, and a brass Rally sat beside the
                  brass End Turn that no-moves-left lights. */}
              {!gameOver && playerTurn && canRally(moveState) && (
                <button
                  type="button"
                  className={`${ACTION} btn-brass foil relative`}
                  onClick={(e) => {
                    if (viaKeys(e)) refocusRef.current = { kind: 'turn' };
                    rally();
                  }}
                >
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
              {mulliganOpen && (
                <>
                  {mulliganPicks.size > 0 && (
                    <button
                      type="button"
                      className={`${ACTION} btn-glass`}
                      onClick={() => finishMulligan(mulliganPicks)}
                    >
                      Swap {mulliganPicks.size}
                    </button>
                  )}
                  <button
                    type="button"
                    className={`${ACTION} btn-brass`}
                    onClick={() => finishMulligan(new Set())}
                  >
                    Keep hand
                  </button>
                </>
              )}
              {playerMove && (
                <button
                  ref={endTurnRef}
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
          data-coach-scroll=""
          className={`board-zoom relative shrink-0 max-w-full overflow-x-auto overflow-y-hidden px-3 sm:px-6 pt-11 pb-6 ${handFit.overflow
            ? '[mask-image:linear-gradient(90deg,transparent,#000_16px,#000_calc(100%-16px),transparent)]'
            : ''}`}
        >
          {coachCopy && (
            <div
              data-first-fight={coachStep}
              className="absolute inset-x-3 top-0 z-30 flex h-11 items-center gap-2 rounded-xl bg-night-950/95 px-2 ring-1 ring-brass-300/40 sm:inset-x-6"
            >
              <p className="min-w-0 flex-1 truncate text-xs font-semibold text-plush-100">
                <span className="text-brass-200">{coachCopy.title}. </span>
                {coachCopy.body}
              </p>
              <button
                type="button"
                className={`${ACTION} btn-glass h-11 shrink-0 px-3 text-xs`}
                onClick={finishFirstFight}
              >
                Skip
              </button>
            </div>
          )}
          <div className="mx-auto flex w-max gap-2">
            {/* Keyed by game, as the rows are: Play Again remounts the hand,
                rather than playing the last game's cards out beside the new
                deal (holding their slots, so it dealt in with gaps) and
                reviving the ones whose ids recur in place of dealing them. */}
            <AnimatePresence key={gameId}>
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
                const picked = mulliganOpen && mulliganPicks.has(card.instanceId);
                const toggle = pressHandCard(card, false, index);
                const press = mulliganOpen
                  ? { ...describedPress(pressable(toggle, picked ? `Keep ${card.name} in hand` : `Throw back ${card.name}`), `desc-hand-${card.instanceId}`), 'aria-pressed': picked }
                  : playable
                    ? describedPress(pressable(pressHandCard(card, true, index), `Play ${card.name}`), `desc-hand-${card.instanceId}`)
                    : { onClick: pressHandCard(card, false, index) };
                return (
                  <HandSlot
                    key={card.instanceId}
                    data-hand-id={card.instanceId}
                    data-raised={raised ? '' : undefined}
                    initial={{ y: 50, opacity: 0 }}
                    animate={raised
                      ? { y: -20, scale: 1.08, opacity: 1, rotate: 0, zIndex: 20 }
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
                    data-mulligan-picked={picked ? '' : undefined}
                    className={`relative shrink-0 rounded-[10px] ${FOCUS_OUTLINE} ${playable || mulliganOpen ? 'cursor-pointer' : ''} ${picked ? 'ring-2 ring-brass-300' : ''} ${!mulliganOpen && !affordable
                      ? 'opacity-50 saturate-50'
                      : lit ? 'shadow-[0_0_16px_1px_rgba(251,191,36,0.4)]' : ''}`}
                    {...inspectHandlers({ id: card.instanceId, from: 'hand' }, mulliganOpen ? {} : { hold: 'raise' })}
                    press={press}
                  >
                    {/* The face is said in words (CardWords). */}
                    <div aria-hidden="true">
                      <TeddyCard teddy={card} cosmeticBorder={cosmeticBorder} lift={false} costDelta={cost - card.cost} />
                    </div>
                    {/* What the dimming says, too: pressed now, it is refused. */}
                    <CardWords id={`desc-hand-${card.instanceId}`} card={card} press={press}>
                      {`${describeCard(card, { cost })}${playable && !affordable ? ' Not enough energy.' : ''}`}
                    </CardWords>
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
                  {playerDeck.length === 0 && (
                    <span className="text-brass-200" data-fatigue="player">
                      {' '}· next {playerFatigue + 1}
                      <span className="sr-only"> fatigue</span>
                    </span>
                  )}
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
                {playerEnergy}<span className="text-sm font-bold text-plush-300">/{Math.min(MAX_ENERGY, energyForTurn(turnCount) + (houseRule.energy || 0))}</span>
              </span>
              <span className="sr-only">{playerEnergy} of {Math.min(MAX_ENERGY, energyForTurn(turnCount) + (houseRule.energy || 0))} energy</span>
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
