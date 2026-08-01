import { useState } from 'react';
import { Card } from "@/components/ui/card";
import { motion } from 'framer-motion';
import { RARITY } from '@/lib/rarity';

// Dark-face fallbacks for cards without a rarity (typed opponent cards).
const TYPE_STYLES = {
  action: { bg: 'from-amber-900 to-night-800', border: 'border-amber-500', text: 'text-amber-300' },
  trap: { bg: 'from-purple-900 to-night-800', border: 'border-purple-500', text: 'text-purple-300' },
  special: { bg: 'from-cyan-900 to-night-800', border: 'border-cyan-500', text: 'text-cyan-300' },
};

const ABILITY_ICONS = {
  taunt: '🛡️',
  piercing: '🗡️',
  shield: '🔰',
  stealth: '👻',
  protect: '🏰',
  fury: '😤',
  swarm: '🐜',
  royal: '👑',
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
// Fallback is two-stage: a failed thumb retries the full-res image before
// giving up on the emoji, so a missing/stale thumbs/ entry never regresses
// a card that does have full art.
export const ArtOrEmoji = ({ teddy, emojiClassName = 'text-3xl', imgClassName = '', variant = 'thumb' }) => {
  // Track which card id failed at which stage (not a boolean): a reused
  // component instance re-rendered with a different teddy must retry that
  // card's art instead of inheriting the previous card's failure, and a
  // thumb failure for this card must not be confused with a full-image
  // failure for it.
  const [failed, setFailed] = useState({ id: null, stage: null });

  const thumbFailed = failed.id === teddy.id && failed.stage === 'thumb';
  const fullFailed = failed.id === teddy.id && failed.stage === 'full';

  if (!teddy.id || fullFailed) {
    return <div className={emojiClassName}>{getTeddyEmoji(teddy)}</div>;
  }

  // Once the thumb has failed for this card, fall through to the full
  // image regardless of the requested variant — that's the whole point of
  // the fallback chain.
  const useFull = variant === 'full' || thumbFailed;
  const src = useFull ? `/cards/${teddy.id}.webp` : `/cards/thumbs/${teddy.id}.webp`;

  return (
    <img
      src={src}
      alt=""
      loading="lazy"
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

// One-line rules text for the textbox, like a real TCG card. Ability
// keywords for creatures; effect summaries for traps and specials. Ability
// wins over effect — no card in ALL_CARDS carries both; revisit if one does.
const rulesText = (teddy) => {
  if (teddy.ability && teddy.ability !== 'none') {
    const label = teddy.ability.charAt(0).toUpperCase() + teddy.ability.slice(1);
    return `${ABILITY_ICONS[teddy.ability] || '✨'} ${label}`;
  }
  if (teddy.effect === 'heal') return `💚 +${teddy.amount} HP`;
  if (teddy.effect === 'draw') return `🃏 Draw ${teddy.amount}`;
  if (teddy.effect === 'damage') return `💥 ${teddy.amount} DMG`;
  if (teddy.effect === 'buff') return `💪 +${teddy.amount} ATK`;
  return null;
};

/**
 * TCG-anatomy card frame at hand size (96×144):
 * name banner → cost gem → framed art window → type/rarity line → textbox,
 * with circular attack/HP gems anchored in the bottom corners and a foil
 * sheen on epic+ cards.
 */
const TeddyCard = ({ teddy, onClick, isSelected = false, isDisabled = false }) => {
  // Use rarity style if available, otherwise fall back to type style
  const rarityStyle = teddy.rarity ? RARITY[teddy.rarity] : null;
  const typeStyle = TYPE_STYLES[teddy.type] || TYPE_STYLES.action;
  const style = rarityStyle || typeStyle;

  const isAction = teddy.type === 'action';
  const hp = teddy.currentHp ?? teddy.defense;
  const wounded = teddy.currentHp !== undefined && teddy.currentHp < teddy.defense;
  const rules = rulesText(teddy);

  return (
    <motion.div
      whileHover={!isDisabled ? { scale: 1.03 } : {}}
      whileTap={!isDisabled ? { scale: 0.97 } : {}}
    >
      <Card
        className={`
          w-24 h-36 rounded-lg shadow-lg shadow-black/40 cursor-pointer transition-all relative flex flex-col p-0 overflow-hidden
          bg-gradient-to-b ${style.bg}
          border-2 ${style.border}
          ${isSelected ? 'ring-2 ring-brass-300 ring-offset-2 ring-offset-night-900' : ''}
          ${isDisabled ? 'opacity-50 cursor-not-allowed' : 'hover:shadow-xl hover:shadow-black/50'}
        `}
        onClick={!isDisabled ? onClick : undefined}
      >
        {/* Foil sheen for high rarities */}
        {teddy.rarity === 'epic' && (
          <div className="absolute inset-0 pointer-events-none opacity-20 mix-blend-screen bg-[linear-gradient(115deg,transparent_25%,rgba(56,189,248,0.6)_40%,rgba(168,85,247,0.6)_55%,rgba(251,191,36,0.5)_70%,transparent_85%)]" />
        )}
        {teddy.rarity === 'legendary' && (
          <div className="absolute inset-0 bg-gradient-to-br from-transparent via-brass-300/20 to-transparent pointer-events-none animate-pulse" />
        )}

        {/* Name banner */}
        <div className="flex items-center shrink-0 h-[18px] pl-1.5 pr-6 bg-night-950/70 border-b border-white/10">
          <span className="font-display font-bold text-[8px] text-plush-100 truncate leading-none" title={teddy.name}>
            {teddy.name}
          </span>
        </div>

        {/* Cost gem */}
        {teddy.cost !== undefined && (
          <div className="absolute top-[2px] right-[3px] w-4 h-4 rounded-full bg-gradient-to-b from-brass-200 to-brass-500 border border-night-950 shadow text-night-950 text-[9px] font-bold grid place-items-center z-10">
            {teddy.cost}
          </div>
        )}

        {/* Art window */}
        <div className="mx-1 mt-1 h-[52px] shrink-0 rounded border border-white/15 bg-night-950/40 shadow-inner overflow-hidden grid place-items-center">
          <ArtOrEmoji
            teddy={teddy}
            emojiClassName="text-[26px] drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)]"
            imgClassName="w-full h-full object-cover"
          />
        </div>

        {/* Type / rarity line */}
        <div className="mx-1 mt-0.5 shrink-0 flex items-center justify-between h-[11px] px-1 rounded-sm bg-night-950/50">
          <span className="text-[6px] uppercase tracking-wider font-bold text-plush-300">{teddy.type}</span>
          {teddy.rarity && (
            <span className={`text-[6px] uppercase tracking-wider font-bold ${style.text}`}>{teddy.rarity}</span>
          )}
        </div>

        {/* Textbox — ability keyword or effect line; stat gems overlap its
            bottom corners like a real card frame. */}
        <div className="mx-1 my-0.5 flex-1 rounded-sm bg-white/5 border border-white/10 px-1 pt-1 overflow-hidden">
          {rules && (
            <div className="text-[7px] leading-tight text-center font-semibold text-plush-200" title={teddy.ability && teddy.ability !== 'none' ? teddy.ability : undefined}>
              {rules}
            </div>
          )}
        </div>

        {/* Stat gems (creatures only): attack bottom-left, HP bottom-right */}
        {isAction && (
          <>
            <div className="absolute bottom-[3px] left-[3px] w-[22px] h-[22px] rounded-full bg-gradient-to-b from-red-400 to-red-700 border-2 border-night-950 shadow text-white text-[10px] font-bold grid place-items-center z-10" title="Attack">
              {teddy.attack}
            </div>
            <div
              className={`absolute bottom-[3px] right-[3px] w-[22px] h-[22px] rounded-full bg-gradient-to-b border-2 border-night-950 shadow text-white text-[10px] font-bold grid place-items-center z-10 ${
                wounded ? 'from-red-500 to-red-800' : 'from-sky-400 to-sky-700'
              }`}
              title="HP"
            >
              {hp}
            </div>
          </>
        )}
      </Card>
    </motion.div>
  );
};

export default TeddyCard;
