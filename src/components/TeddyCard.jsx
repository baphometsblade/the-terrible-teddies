import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Shield, Crosshair, ShieldHalf, Ghost, Castle, Flame, Bug, Crown,
  Heart, Layers, Bomb, Swords, Sparkles,
} from 'lucide-react';
import { RARITY, RARITY_METAL } from '@/lib/rarity';
import { BrassCoin } from '@/components/ui/coin';
import { COSMETIC_FRAMES } from '@/lib/cosmetics';

// Dark-face fallbacks for cards without a rarity (typed opponent cards).
const TYPE_STYLES = {
  action: { bg: 'from-amber-900 to-night-800', border: 'border-amber-500', text: 'text-amber-300' },
  trap: { bg: 'from-purple-900 to-night-800', border: 'border-purple-500', text: 'text-purple-300' },
  special: { bg: 'from-cyan-900 to-night-800', border: 'border-cyan-500', text: 'text-cyan-300' },
};
const TYPE_METAL = {
  action: RARITY_METAL.legendary,
  trap: RARITY_METAL.epic,
  special: RARITY_METAL.rare,
};

// Battle Pass border cosmetics replace the rarity's metal with their own and
// add a glow (COSMETIC_FRAMES, in src/lib/cosmetics.js); the rarity stays
// readable from the type line.

// One icon set for every ability and effect. These were emoji, which every
// platform draws differently and which looked like stickers next to the
// photographic card art.
const ABILITY_ICONS = {
  taunt: Shield,
  piercing: Crosshair,
  shield: ShieldHalf,
  stealth: Ghost,
  protect: Castle,
  fury: Flame,
  swarm: Bug,
  royal: Crown,
};
const EFFECT_ICONS = {
  heal: Heart,
  draw: Layers,
  damage: Bomb,
  buff: Swords,
};

const getTeddyEmoji = (teddy) => {
  if (teddy.type === 'trap') return '🪤';
  if (teddy.type === 'special') return '✨';

  // All-bear cast: every action card's art is a teddy variant. Rarity is
  // already communicated by the frame, badge, and shine — the art's job is
  // to keep the world 100% teddy.
  const rarityEmojis = {
    legendary: ['🐻‍❄️', '🧸'],
    epic: ['🐻‍❄️', '🐻'],
    rare: ['🐻', '🧸'],
    uncommon: ['🧸', '🐻'],
    common: ['🧸', '🐻'],
  };
  const options = rarityEmojis[teddy.rarity] || ['🧸', '🐻'];
  return options[(teddy.id || 0) % options.length];
};

// Card art slot: shows the generated illustration for this card if one has
// been shipped under public/cards/<id>.webp (or its small-viewport twin at
// public/cards/thumbs/<id>.webp), and silently falls back to the emoji cast
// when no file loads — art can never break a card. alt="" keeps the art
// decorative so accessible names don't change.
//
// `variant` picks the source: 'thumb' (default) serves the 192x256
// thumbnail for the many places art renders small (collection grid, battle
// hand) — those spots have no use for a 768x1024 original and downloading
// one there is pure waste (~9x the bytes a thumb needs, see
// scripts/make-card-thumbs.mjs). 'full' serves the original for the few
// spots that render art large enough to need it (e.g. the collection
// detail modal).
//
// 'responsive' offers both through srcset and lets the browser choose by
// pixel density, for art drawn bigger than hand size but far smaller than
// the original — the menu's enlarged hero cards, where a thumbnail on a
// retina phone was upscaled about 2x and looked soft next to the frame.
// A standard-density screen still downloads only the thumbnail.
//
// Fallback is two-stage: a failed thumb retries the full-res image before
// giving up on the emoji, so a missing/stale thumbs/ entry never regresses
// a card that does have full art. A failed responsive image drops to that
// same chain.
//
// `loading` is lazy by default, for the long grids; a card that is shown the
// moment it mounts (a pack reveal's face) passes 'eager'. Decoding is async
// either way, so a large image never holds up the frame that shows it.
//
// The <img> takes no pointer events: it is alt="" decoration and the card
// around it owns the tap. Hit-testable, a long-press landed on the image and
// opened the phone's Save Image / Copy callout instead of reaching the card
// (draggable={false} only stops a desktop drag).
export const ArtOrEmoji = ({ teddy, emojiClassName = 'text-3xl', imgClassName = '', variant = 'thumb', sizes = '144px', loading = 'lazy' }) => {
  // Track which card id failed at which stage (not a boolean): a reused
  // component instance re-rendered with a different teddy must retry that
  // card's art instead of inheriting the previous card's failure, and a
  // thumb failure for this card must not be confused with a full-image
  // failure for it.
  const [failed, setFailed] = useState({ id: null, stage: null });

  const thumbFailed = failed.id === teddy.id && failed.stage === 'thumb';
  const fullFailed = failed.id === teddy.id && failed.stage === 'full';
  const responsiveFailed = failed.id === teddy.id && failed.stage === 'responsive';

  if (!teddy.id || fullFailed) {
    return <div className={emojiClassName}>{getTeddyEmoji(teddy)}</div>;
  }

  // Once the thumb has failed for this card, fall through to the full
  // image regardless of the requested variant — that's the whole point of
  // the fallback chain.
  const thumb = `/cards/thumbs/${teddy.id}.webp`;
  const full = `/cards/${teddy.id}.webp`;
  if (variant === 'responsive' && !responsiveFailed && !thumbFailed) {
    return (
      <img
        src={thumb}
        srcSet={`${thumb} 192w, ${full} 768w`}
        sizes={sizes}
        alt=""
        loading={loading}
        decoding="async"
        draggable={false}
        className={`pointer-events-none ${imgClassName}`}
        onError={() => setFailed({ id: teddy.id, stage: 'responsive' })}
      />
    );
  }
  const useFull = variant === 'full' || thumbFailed;
  const src = useFull ? full : thumb;

  return (
    <img
      src={src}
      alt=""
      loading={loading}
      decoding="async"
      draggable={false}
      className={`pointer-events-none ${imgClassName}`}
      onError={() => setFailed({ id: teddy.id, stage: useFull ? 'full' : 'thumb' })}
    />
  );
};

// The back of every card in the game: night felt, stitched seam, brass
// emblem rings. Used for facedown reveals and the deck stacks on the board.
export const CardBack = ({ className = 'w-24 h-36', mini = false }) => (
  <div
    className={`${className} rounded-lg border-2 border-plush-700 bg-gradient-to-br from-night-700 via-night-800 to-night-950 stitched-plush relative overflow-hidden grid place-items-center shadow-lg shadow-black/40`}
  >
    <div className="absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_50%_45%,#fbbf24_0%,transparent_60%)]" />
    <div className={`rounded-full border-2 border-brass-400/60 grid place-items-center ${mini ? 'w-5 h-5' : 'w-12 h-12'}`}>
      <div className={`rounded-full border border-brass-400/40 grid place-items-center ${mini ? 'w-3.5 h-3.5 text-[8px]' : 'w-9 h-9 text-xl'}`}>
        🧸
      </div>
    </div>
  </div>
);

// A font size for print on the battle table, which the board scales to fit
// the felt (`zoom`, down to 0.45 on a short phone): raised just enough to
// stay at 8px or more on screen, in half pixels, and left alone at full size.
export const legibleSize = (px, zoom = 1) => (zoom < 1 ? Math.max(px, Math.ceil((8 / zoom) * 2) / 2) : px);

// One-line rules for the card: the ability keyword for creatures, an effect
// summary for traps and specials. Ability wins over effect — no card in
// ALL_CARDS carries both; revisit if one does.
const rulesFor = (teddy) => {
  if (teddy.ability && teddy.ability !== 'none') {
    return {
      Icon: ABILITY_ICONS[teddy.ability] || Sparkles,
      label: teddy.ability.charAt(0).toUpperCase() + teddy.ability.slice(1),
    };
  }
  const Icon = EFFECT_ICONS[teddy.effect];
  if (!Icon) return null;
  const label = {
    heal: `+${teddy.amount} HP`,
    draw: `Draw ${teddy.amount}`,
    damage: `${teddy.amount} DMG`,
    buff: `+${teddy.amount} ATK`,
  }[teddy.effect];
  return { Icon, label };
};

// The two stat badges. Enamel pins rather than flat circles: a coloured face
// with a highlight along its top edge and a dark ring that seats it on the
// art. The faces are dark enough for white numerals at every point the digits
// cross (red-600/sky-700 at the top, 4.8:1 and 5.9:1, deepening below), and
// the highlight stays in the top band above them. The first version lit the
// upper half, right through the digits, over faces that started at red-400 and
// sky-400 — 2.8:1 and 2.1:1 — on every creature in the game.
const StatBadge = ({ value, title, tone, className, board = false, fontSize, ...data }) => (
  <div
    {...data}
    title={title}
    className={`absolute bottom-[3px] z-10 rounded-full grid place-items-center
      text-white font-display font-extrabold leading-none tabular-nums
      ring-[1.5px] ring-night-950 shadow-[0_2px_4px_rgba(0,0,0,0.6)]
      ${board ? 'w-[28px] h-[28px] text-[14px]' : 'w-[22px] h-[22px] text-[11px]'} ${className}`}
    style={{
      background: `radial-gradient(ellipse 70% 32% at 50% 0%, rgba(255,255,255,0.4), transparent 100%), ${tone}`,
      textShadow: '0 1px 1px rgba(0,0,0,0.6)',
      ...(fontSize ? { fontSize } : {}),
    }}
  >
    {value}
  </div>
);

const ATTACK_TONE = 'linear-gradient(180deg, #dc2626, #7f1d1d)';
// Attack a Royal ally is raising right now: the same pin struck in emerald,
// as the discounted cost coin is. Emerald-700 at the top keeps the white
// numerals above 4.5:1 wherever they cross, as the red and blue faces do.
const ATTACK_BUFFED_TONE = 'linear-gradient(180deg, #047857, #064e3b)';
const HP_TONE = 'linear-gradient(180deg, #0369a1, #0c4a6e)';
const WOUNDED_TONE = 'linear-gradient(180deg, #b91c1c, #450a0a)';

// A cost an effect has lowered (Swarm, with another creature already down):
// the same coin struck in green, as Hearthstone marks a discounted cost.
const COIN_DISCOUNT = 'radial-gradient(circle at 50% 30%, #ecfdf5, #34d399 55%, #047857)';

// Taunt on the table, in the colours of the side it guards: the player's
// brass, Chuck's crimson (the board's own metals).
const TAUNT_TONE = {
  player: {
    edge: '#fbbf24',
    glow: 'rgba(251, 191, 36, 0.42)',
    plate: 'linear-gradient(180deg, #fde68a 0%, #fbbf24 45%, #b45309 100%)',
    icon: 'text-night-950',
  },
  opponent: {
    edge: '#ef4444',
    glow: 'rgba(239, 68, 68, 0.45)',
    plate: 'linear-gradient(180deg, #f87171 0%, #dc2626 50%, #7f1d1d 100%)',
    icon: 'text-white',
  },
};

// A board card's ability, as an icon between its stat badges, with its name
// in sr-only text for where the card is content. Where the card is a control
// (a button's children are presentational), the board's description says it
// instead (describeCard, src/lib/abilities.js). Taunt's is a metal plate in its side's colours, part of the frame drawn
// around the card (see TeddyCard): the rule that decides where every attack
// goes has to read from across the table.
const AbilityChip = ({ rules, taunt }) => (
  <div
    className={`absolute bottom-[5px] left-1/2 -translate-x-1/2 z-10 grid place-items-center rounded-full
      shadow-[0_2px_4px_rgba(0,0,0,0.6)] ${taunt
      ? `h-[24px] w-[24px] ring-[1.5px] ring-night-950 ${taunt.icon}`
      : 'h-[20px] w-[20px] bg-night-950/90 ring-1 ring-brass-300/50 text-brass-300'}`}
    style={taunt ? { background: taunt.plate } : undefined}
    title={rules.label}
  >
    <rules.Icon aria-hidden="true" className={taunt ? 'h-[14px] w-[14px]' : 'h-[12px] w-[12px]'} strokeWidth={2.5} fill={taunt ? 'currentColor' : 'none'} />
    <span className="sr-only">{rules.label}</span>
  </div>
);

// Rarity at hand size: a small cut gem in the tier's own metal, between the
// stat badges — the genre's convention (Hearthstone's gem), and legible at any
// zoom, which the word was not. It used to be the word in 6px small caps,
// tracked 0.12em, which at 1x rounded apart into "COMM ON" and "E PIC"; at a
// legible 8px, untracked, "Uncommon" is 43px wide and the gap between the
// badges is 42. The name is sr-only, for where the card is content; on the
// board, where a card is a control, its description says what it is.
const RarityGem = ({ rarity }) => (
  <>
    <span
      aria-hidden="true"
      data-rarity-gem={rarity}
      className="inline-block h-[8px] w-[8px] rotate-45 rounded-[1.5px] ring-1 ring-night-950/80 shadow-[0_1px_2px_rgba(0,0,0,0.7)]"
      style={{ background: RARITY_METAL[rarity] }}
    />
    <span className="sr-only">{rarity}</span>
  </>
);

/**
 * The card at hand size (96×144), built around its art.
 *
 * The art fills the whole face. The previous frame gave it a 52px window — a
 * third of the card — above a textbox that was empty on every creature without
 * an ability, which is most of them: the one genuinely premium asset in the
 * game, the photographic plush art, was the smallest thing on the card. Now
 * the art is the card, with dark scrims at the top and bottom carrying the
 * name, the rules line and the stats, and a metallic frame per rarity drawn
 * as a gradient border. Epic and legendary carry a slow foil sweep
 * (index.css .foil), which honours the Animations switch.
 *
 * `variant="board"` is the same card on the battle table, where the rows are
 * scaled to fit the felt — to 0.6 and below on a small phone — and the hand
 * layout's small print fell apart: a 6px rarity line at 3.5px, 11px stats at
 * 6.5px. On the table the cost has been paid and means nothing, and the
 * frame's metal already says the rarity, so both go; the stats grow to 28px
 * badges with 14px numerals; the ability is an icon between them; and Taunt
 * is a frame treatment rather than a label over the name. `side` picks
 * Taunt's colours and `tauntActive` whether it is in force (a stealthed card
 * is not targetable at all, so its Taunt guards nothing).
 *
 * No text under 8px is letter-spaced, at any size: tracked 6px small caps
 * render as "COMM ON" and "E PIC" at 1x, the spacing rounding to whole pixels.
 */
// `lift` turns off the card's own hover lift, for wrappers that lift the card
// themselves and draw rings around it (the battle board): two lifts stacked,
// and the inner one moved the card out of the ring drawn around it.
// `artVariant` is ArtOrEmoji's variant, for cards drawn larger than hand size,
// and `artLoading` its loading hint.
// `dimmed` greys the art only — for a card the player does not own yet. The
// collection used to filter the whole card, which took the name, cost and
// stats below AA along with the picture.
// `costDelta` is what an effect does to the printed cost right now (Swarm's
// -1): the coin shows the cost the player would actually pay, in green when
// it is lower than printed.
// `resting` is a creature on the table that cannot attack this turn (Warming
// Up, Exhausted): its art dims, less than `dimmed` does, and nothing else
// does. The board used to fade the whole card, which took the Taunt frame
// down with it, and a resting Taunt creature still decides where every one
// of Chuck's attacks goes.
// `attackDelta` is what an aura adds to the printed attack right now (a
// Royal ally's +1): the badge shows the attack the card actually hits for,
// in emerald when raised, as costDelta does for the cost. Damage always
// included it; the badge used to print the base figure, so the numbers on
// the table did not add up to the ones in the log.
// `zoom` (board only) is the scale the table draws the card at. The small
// print — the numerals, a trap's two lines — grows by as much as it takes
// to stay at 8px or more on screen, and `nameless` (board only) drops the
// name, which cannot: at 0.64 on a 320px phone it rendered at 6.4px, and
// counter-scaled it would run to two lines over half the card. The card's
// control still names it, and its preview shows it whole.
const TeddyCard = ({
  teddy, onClick, isSelected = false, isDisabled = false, cosmeticBorder = null,
  lift = true, artVariant = 'thumb', artLoading = 'lazy', dimmed = false,
  variant = 'hand', costDelta = 0, attackDelta = 0, side = 'player', tauntActive, resting = false,
  nameless = false, zoom = 1,
}) => {
  const board = variant === 'board';
  const legible = (px) => (board ? legibleSize(px, zoom) : px);
  const showName = !(board && nameless);
  // Use rarity style if available, otherwise fall back to type style
  const rarityStyle = teddy.rarity ? RARITY[teddy.rarity] : null;
  const typeStyle = TYPE_STYLES[teddy.type] || TYPE_STYLES.action;
  const style = rarityStyle || typeStyle;
  const cosmetic = cosmeticBorder ? COSMETIC_FRAMES[cosmeticBorder] : null;
  const metal = cosmetic?.metal
    || (teddy.rarity ? RARITY_METAL[teddy.rarity] : TYPE_METAL[teddy.type] || TYPE_METAL.action);

  const isAction = teddy.type === 'action';
  const hp = teddy.currentHp ?? teddy.defense;
  const wounded = teddy.currentHp !== undefined && teddy.currentHp < teddy.defense;
  const rules = rulesFor(teddy);
  const foil = teddy.rarity === 'legendary' ? 'foil' : teddy.rarity === 'epic' ? 'foil foil-epic' : '';
  const cost = teddy.cost !== undefined ? teddy.cost + costDelta : undefined;
  const discounted = costDelta < 0;
  const taunt = board && (tauntActive ?? teddy.ability === 'taunt')
    ? TAUNT_TONE[side] || TAUNT_TONE.player
    : null;
  // On the table a creature's ability is the chip between its stats; a trap
  // keeps its rules line, since what it springs for is the whole card.
  const abilityChip = board && isAction && rules;
  const typeLabel = teddy.type ? teddy.type.charAt(0).toUpperCase() + teddy.type.slice(1) : '';

  return (
    // whileHover only — no whileTap. Framer Motion makes any element with a
    // tap gesture keyboard-reachable by giving it tabindex="0", so every card
    // in the game was a hidden tab stop that did nothing when activated: a
    // keyboard player tabbing a hand of seven met fourteen stops, half of them
    // dead, and the decorative cards on the menu put focusable content inside
    // aria-hidden (axe: aria-hidden-focus). The press is visual only, so CSS
    // :active does it without touching focus; the real controls are the
    // pressable wrappers each screen puts around the card.
    <motion.div
      whileHover={lift && !isDisabled ? { y: -3, scale: 1.03 } : {}}
      transition={{ type: 'spring', stiffness: 400, damping: 26 }}
    >
      <div
        data-cosmetic={cosmeticBorder || undefined}
        data-variant={board ? 'board' : undefined}
        data-taunt={taunt ? side : undefined}
        // A pointer and a press only where something takes the press: this
        // card's own onClick, or the control around it ([role=button] — a
        // pressable wrapper that is not actionable has no role). Always on,
        // they made every card on the board look clickable, Chuck's and a
        // warming-up creature's included, under the board's own cursors.
        className={`
          w-24 h-36 rounded-[10px] relative overflow-hidden transition-transform duration-100
          ${isDisabled
            ? 'opacity-50 cursor-not-allowed'
            : `${onClick ? 'cursor-pointer active:scale-[0.97]' : ''} [[role=button]:active_&]:scale-[0.97]`}
        `}
        style={{
          border: '2px solid transparent',
          // The face (padding-box) under the metal (border-box): the standard
          // way to give a rounded element a gradient border.
          background: `linear-gradient(#120c1c, #120c1c) padding-box, ${metal} border-box`,
          // The selection ring lives in this same value: a Tailwind ring-2 is
          // a box-shadow too, and an inline boxShadow silently replaced it.
          boxShadow: `${isSelected ? '0 0 0 2px #1a1226, 0 0 0 4px #fcd34d, ' : ''}0 6px 14px -4px rgba(0,0,0,0.7)${cosmetic ? `, ${cosmetic.glow}` : ''}`,
        }}
        onClick={!isDisabled ? onClick : undefined}
      >
        {/* Full-bleed art. The emoji fallback sits on the tier's own face
            gradient so a card without art still reads as its rarity. */}
        <div
          data-art=""
          data-resting={resting && !dimmed ? '' : undefined}
          className={`absolute inset-0 rounded-[8px] overflow-hidden grid place-items-center bg-gradient-to-b ${style.bg} ${dimmed
            ? 'saturate-[0.3] brightness-[0.55]'
            : resting ? 'saturate-[0.6] brightness-[0.6]' : ''}`}
        >
          <ArtOrEmoji
            teddy={teddy}
            variant={artVariant}
            loading={artLoading}
            emojiClassName="text-[34px] drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)] -mt-2"
            imgClassName="absolute inset-0 w-full h-full object-cover"
          />
        </div>

        {/* Foil sweep (epic+) — above the art, below the text. */}
        {foil && !dimmed && !resting && <div className={`absolute inset-0 rounded-[8px] pointer-events-none ${foil}`} />}

        {/* Taunt's frame: a band of its side's metal just inside the rarity
            frame, lit inward, so a guarded card reads as walled in. Inside
            the card rather than a ring around it, because the board draws its
            own rings there (the valid-target red, the selection brass) and a
            second ring in the same place would hide them. */}
        {taunt && (
          <div
            aria-hidden="true"
            className="absolute inset-0 z-[5] rounded-[8px] pointer-events-none"
            style={{ boxShadow: `inset 0 0 0 2px ${taunt.edge}, inset 0 0 14px 2px ${taunt.glow}` }}
          />
        )}

        {/* Scrims: a shallow one under the name, a deeper one under the rules
            and stats, so the text stays legible over any art. */}
        {showName && <div className="absolute inset-x-0 top-0 h-9 bg-gradient-to-b from-black/80 via-black/45 to-transparent pointer-events-none" />}
        <div className={`absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/95 via-black/70 to-transparent pointer-events-none ${board ? 'h-[50px]' : 'h-[62px]'}`} />

        {/* Name: up to two lines, which the top scrim covers. On one line 38
            of the 64 names were cut to an ellipsis, and the only way to read
            the rest was a hover tooltip that touch screens never show. In the
            hand it starts after the cost coin; on the board there is no coin,
            so it starts at the edge and stops short of the corner the target
            crosshair sits on. */}
        {showName && (
          <div className={`absolute top-[3px] z-10 ${board ? 'left-[5px] right-[16px]' : cost === undefined ? 'left-[5px] right-[22px]' : 'left-[22px] right-[5px]'}`}>
            <span
              className={`block font-display font-extrabold leading-[1.1] text-white line-clamp-2 break-words ${board ? 'text-[10px]' : 'text-[9px]'}`}
              style={{ textShadow: '0 1px 2px rgba(0,0,0,0.9)' }}
              title={teddy.name}
            >
              {teddy.name}
            </span>
          </div>
        )}

        {/* Cost: a brass coin, green when an effect has lowered it. Not on
            the table, where it has been paid. Top LEFT, as Hearthstone and
            Snap print it: the hand overlaps left to right, so each card shows
            only its left edge, and a coin in the right corner was hidden under
            the next card on every card but the last. */}
        {!board && cost !== undefined && (
          <BrassCoin
            size="card"
            className="absolute top-[2px] left-[2px] z-10"
            data-cost=""
            data-discounted={discounted ? '' : undefined}
            {...(discounted ? { style: { background: COIN_DISCOUNT }, title: `Discounted from ${teddy.cost}` } : {})}
          >
            {cost}
          </BrassCoin>
        )}

        {/* Rules line (hand size, and a trap on the table, where it sits
            over the type label whatever size the two have grown to) */}
        {rules && !abilityChip && (
          <div
            className={`absolute inset-x-[4px] z-10 flex items-center justify-center gap-[3px] font-bold leading-none text-plush-100 ${board ? '' : 'bottom-[34px] text-[8px]'}`}
            style={{
              textShadow: '0 1px 2px rgba(0,0,0,0.9)',
              ...(board ? { bottom: Math.max(20, 9 + legible(9)), fontSize: legible(10) } : {}),
            }}
            title={teddy.ability && teddy.ability !== 'none' ? teddy.ability : undefined}
          >
            <rules.Icon aria-hidden="true" className={`shrink-0 text-brass-300 ${board ? 'w-[11px] h-[11px]' : 'w-[9px] h-[9px]'}`} strokeWidth={2.5} />
            <span className="truncate">{rules.label}</span>
          </div>
        )}
        {abilityChip && <AbilityChip rules={rules} taunt={taunt} />}

        {/* Type and rarity, one line, at hand size. On a creature the stat
            badges flank it and the type is already implied — only creatures
            carry stats — so it is the rarity gem alone. Traps and specials
            print their type beside the gem, at 8px and untracked, in the
            display face on purpose: it is the bundled font, so the width is
            the same on every platform. On the table there is no rarity at all
            (the frame's metal says it); a trap keeps its type, the one thing
            that says it is not a creature. */}
        {board ? (
          !isAction && (
            <div
              className="absolute inset-x-[4px] bottom-[6px] z-10 text-center leading-none whitespace-nowrap font-display text-[9px] font-bold text-plush-300"
              style={zoom < 1 ? { fontSize: legible(9) } : undefined}
            >
              {typeLabel}
            </div>
          )
        ) : (
          <div className={`absolute bottom-[10px] z-10 flex items-center justify-center gap-[5px] leading-none whitespace-nowrap font-display text-[8px] font-bold ${isAction ? 'inset-x-[25px]' : 'inset-x-[4px]'}`}>
            {(!isAction || !teddy.rarity) && <span className="text-plush-300">{typeLabel}</span>}
            {teddy.rarity && <RarityGem rarity={teddy.rarity} />}
          </div>
        )}

        {/* Stats (creatures only): attack bottom-left, HP bottom-right. */}
        {isAction && (
          <>
            <StatBadge
              board={board}
              value={teddy.attack + attackDelta}
              title={attackDelta > 0 ? `Attack (includes +${attackDelta} from a Royal ally)` : 'Attack'}
              tone={attackDelta > 0 ? ATTACK_BUFFED_TONE : ATTACK_TONE}
              className="left-[3px]"
              fontSize={board && zoom < 1 ? legible(14) : undefined}
              data-stat="attack"
              data-buffed={attackDelta > 0 ? '' : undefined}
            />
            <StatBadge
              board={board}
              value={hp}
              title="HP"
              tone={wounded ? WOUNDED_TONE : HP_TONE}
              className="right-[3px]"
              fontSize={board && zoom < 1 ? legible(14) : undefined}
              data-stat="hp"
            />
          </>
        )}
      </div>
    </motion.div>
  );
};

export default TeddyCard;
