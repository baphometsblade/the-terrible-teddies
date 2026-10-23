import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Shield, Crosshair, ShieldHalf, Ghost, Castle, Flame, Bug, Crown,
  Heart, Layers, Bomb, Swords, Sparkles,
} from 'lucide-react';
import { RARITY, RARITY_METAL } from '@/lib/rarity';

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

// Battle Pass border cosmetics (see src/lib/cosmetics.js). They replace the
// rarity's metal with their own and add a glow; the rarity stays readable
// from the type line. The frame is a gradient border now, so these are
// gradients plus a glow rather than Tailwind border colours.
const COSMETIC_FRAMES = {
  gold: {
    metal: 'linear-gradient(145deg, #fffbeb 0%, #f59e0b 30%, #fef3c7 50%, #b45309 75%, #fde68a 100%)',
    glow: '0 0 12px rgba(251, 191, 36, 0.55)',
  },
  diamond: {
    metal: 'linear-gradient(145deg, #ffffff 0%, #67e8f9 30%, #ecfeff 50%, #0891b2 75%, #a5f3fc 100%)',
    glow: '0 0 12px rgba(103, 232, 249, 0.6)',
  },
};

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
        className={imgClassName}
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
      className={imgClassName}
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
const StatBadge = ({ value, title, tone, className }) => (
  <div
    title={title}
    className={`absolute bottom-[3px] z-10 w-[22px] h-[22px] rounded-full grid place-items-center
      text-white text-[11px] font-display font-extrabold leading-none tabular-nums
      ring-[1.5px] ring-night-950 shadow-[0_2px_4px_rgba(0,0,0,0.6)] ${className}`}
    style={{
      background: `radial-gradient(ellipse 70% 32% at 50% 0%, rgba(255,255,255,0.4), transparent 100%), ${tone}`,
      textShadow: '0 1px 1px rgba(0,0,0,0.6)',
    }}
  >
    {value}
  </div>
);

const ATTACK_TONE = 'linear-gradient(180deg, #dc2626, #7f1d1d)';
const HP_TONE = 'linear-gradient(180deg, #0369a1, #0c4a6e)';
const WOUNDED_TONE = 'linear-gradient(180deg, #b91c1c, #450a0a)';

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
 */
// `lift` turns off the card's own hover lift, for wrappers that lift the card
// themselves and draw rings around it (the battle board): two lifts stacked,
// and the inner one moved the card out of the ring drawn around it.
// `artVariant` is ArtOrEmoji's variant, for cards drawn larger than hand size,
// and `artLoading` its loading hint.
// `dimmed` greys the art only — for a card the player does not own yet. The
// collection used to filter the whole card, which took the name, cost and
// stats below AA along with the picture.
const TeddyCard = ({
  teddy, onClick, isSelected = false, isDisabled = false, cosmeticBorder = null,
  lift = true, artVariant = 'thumb', artLoading = 'lazy', dimmed = false,
}) => {
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
        className={`
          w-24 h-36 rounded-[10px] cursor-pointer relative overflow-hidden transition-transform duration-100
          ${isDisabled ? 'opacity-50 cursor-not-allowed' : 'active:scale-[0.97]'}
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
        <div className={`absolute inset-0 rounded-[8px] overflow-hidden grid place-items-center bg-gradient-to-b ${style.bg} ${dimmed ? 'saturate-[0.3] brightness-[0.55]' : ''}`}>
          <ArtOrEmoji
            teddy={teddy}
            variant={artVariant}
            loading={artLoading}
            emojiClassName="text-[34px] drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)] -mt-2"
            imgClassName="absolute inset-0 w-full h-full object-cover"
          />
        </div>

        {/* Foil sweep (epic+) — above the art, below the text. */}
        {foil && !dimmed && <div className={`absolute inset-0 rounded-[8px] pointer-events-none ${foil}`} />}

        {/* Scrims: a shallow one under the name, a deeper one under the rules
            and stats, so the text stays legible over any art. */}
        <div className="absolute inset-x-0 top-0 h-9 bg-gradient-to-b from-black/80 via-black/45 to-transparent pointer-events-none" />
        <div className="absolute inset-x-0 bottom-0 h-[62px] bg-gradient-to-t from-black/95 via-black/70 to-transparent pointer-events-none" />

        {/* Name: up to two lines, which the top scrim covers. On one line 38
            of the 64 names were cut to an ellipsis, and the only way to read
            the rest was a hover tooltip that touch screens never show. */}
        <div className="absolute top-[3px] left-[5px] right-[22px] z-10">
          <span
            className="block font-display font-extrabold text-[9px] leading-[1.1] text-white line-clamp-2 break-words"
            style={{ textShadow: '0 1px 2px rgba(0,0,0,0.9)' }}
            title={teddy.name}
          >
            {teddy.name}
          </span>
        </div>

        {/* Cost: a brass coin. */}
        {teddy.cost !== undefined && (
          <div
            className="absolute top-[2px] right-[2px] z-10 w-[17px] h-[17px] rounded-full grid place-items-center text-night-950 text-[10px] font-display font-extrabold leading-none tabular-nums ring-1 ring-night-950/80 shadow-[0_1px_3px_rgba(0,0,0,0.6)]"
            style={{ background: 'radial-gradient(circle at 50% 30%, #fffbeb, #fbbf24 55%, #b45309)' }}
          >
            {teddy.cost}
          </div>
        )}

        {/* Rules line */}
        {rules && (
          <div
            className="absolute inset-x-[4px] bottom-[34px] z-10 flex items-center justify-center gap-[3px] text-[8px] font-bold leading-none text-plush-100"
            style={{ textShadow: '0 1px 2px rgba(0,0,0,0.9)' }}
            title={teddy.ability && teddy.ability !== 'none' ? teddy.ability : undefined}
          >
            <rules.Icon aria-hidden="true" className="w-[9px] h-[9px] shrink-0 text-brass-300" strokeWidth={2.5} />
            <span className="truncate">{rules.label}</span>
          </div>
        )}

        {/* Type · rarity, one line. On a creature the stat badges flank it and
            leave ~42px, and the type is already implied — only creatures carry
            stats — so it shows the rarity alone. Traps and specials have the
            full width and show both. In the display face on purpose: it is
            the bundled font, so the width is the same on every platform, and
            in a system sans (the Linux default, for one) UNCOMMON and
            LEGENDARY ran under the badges. */}
        <div className={`absolute bottom-[10px] z-10 text-center leading-none whitespace-nowrap font-display ${isAction ? 'inset-x-[25px]' : 'inset-x-[4px]'}`}>
          {!isAction && (
            <span className="text-[6px] uppercase tracking-[0.12em] font-bold text-plush-300">{teddy.type}</span>
          )}
          {!isAction && teddy.rarity && <span className="text-[6px] text-plush-400 mx-[3px]">·</span>}
          {teddy.rarity ? (
            // Tighter on creatures: the badges leave ~46px, and at 0.12em
            // UNCOMMON and LEGENDARY ran under the HP badge.
            <span className={`text-[6px] uppercase font-bold ${isAction ? 'tracking-[0.04em]' : 'tracking-[0.12em]'} ${style.text}`}>{teddy.rarity}</span>
          ) : isAction && (
            <span className="text-[6px] uppercase tracking-[0.12em] font-bold text-plush-300">{teddy.type}</span>
          )}
        </div>

        {/* Stats (creatures only): attack bottom-left, HP bottom-right. */}
        {isAction && (
          <>
            <StatBadge value={teddy.attack} title="Attack" tone={ATTACK_TONE} className="left-[3px]" />
            <StatBadge value={hp} title="HP" tone={wounded ? WOUNDED_TONE : HP_TONE} className="right-[3px]" />
          </>
        )}
      </div>
    </motion.div>
  );
};

export default TeddyCard;
