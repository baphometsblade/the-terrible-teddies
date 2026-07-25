import { useState } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { motion } from 'framer-motion';
import { RARITY } from '@/lib/rarity';

// Dark-face fallbacks for cards without a rarity (typed opponent cards).
const TYPE_STYLES = {
  action: { bg: 'from-amber-900 to-night-800', border: 'border-amber-500', badge: 'bg-amber-600' },
  trap: { bg: 'from-purple-900 to-night-800', border: 'border-purple-500', badge: 'bg-purple-600' },
  special: { bg: 'from-cyan-900 to-night-800', border: 'border-cyan-500', badge: 'bg-cyan-600' },
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
// been shipped under public/cards/<id>.webp, and silently falls back to the
// emoji cast when the file is missing or fails to load — art can never break
// a card. alt="" keeps the art decorative so accessible names don't change.
export const ArtOrEmoji = ({ teddy, emojiClassName = 'text-3xl', imgClassName = '' }) => {
  const [artFailed, setArtFailed] = useState(false);

  if (!teddy.id || artFailed) {
    return <div className={emojiClassName}>{getTeddyEmoji(teddy)}</div>;
  }

  return (
    <img
      src={`/cards/${teddy.id}.webp`}
      alt=""
      loading="lazy"
      draggable={false}
      className={imgClassName}
      onError={() => setArtFailed(true)}
    />
  );
};

const TeddyCard = ({ teddy, onClick, isSelected = false, isDisabled = false }) => {
  // Use rarity style if available, otherwise fall back to type style
  const rarityStyle = teddy.rarity ? RARITY[teddy.rarity] : null;
  const typeStyle = TYPE_STYLES[teddy.type] || TYPE_STYLES.action;
  const style = rarityStyle || typeStyle;

  return (
    <motion.div
      whileHover={!isDisabled ? { scale: 1.03 } : {}}
      whileTap={!isDisabled ? { scale: 0.97 } : {}}
    >
      <Card
        className={`
          w-24 h-36 rounded-lg shadow-lg shadow-black/40 overflow-hidden cursor-pointer transition-all relative
          stitched-plush
          bg-gradient-to-b ${style.bg}
          border-2 ${style.border}
          ${isSelected ? 'ring-2 ring-brass-300 ring-offset-2 ring-offset-night-900' : ''}
          ${isDisabled ? 'opacity-50 cursor-not-allowed' : 'hover:shadow-xl hover:shadow-black/50'}
        `}
        onClick={!isDisabled ? onClick : undefined}
      >
        {/* Legendary shine effect */}
        {teddy.rarity === 'legendary' && (
          <div className="absolute inset-0 bg-gradient-to-br from-transparent via-brass-300/15 to-transparent pointer-events-none animate-pulse" />
        )}

        <CardContent className="p-1.5 flex flex-col h-full relative">
          {/* Cost badge top-right */}
          {teddy.cost !== undefined && (
            <div className="absolute top-0 right-0 bg-brass-400 text-night-950 w-6 h-6 rounded-bl-lg flex items-center justify-center text-xs font-bold shadow border-l border-b border-brass-500">
              {teddy.cost}
            </div>
          )}

          {/* Type badge */}
          <div className={`${style.badge} text-white text-[7px] px-1 py-0.5 rounded uppercase font-bold self-start`}>
            {teddy.type}
          </div>

          {/* Card art */}
          <div className="flex-1 flex items-center justify-center my-1 min-h-0">
            <ArtOrEmoji
              teddy={teddy}
              emojiClassName="text-3xl drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)]"
              imgClassName="max-h-full max-w-full object-contain rounded"
            />
          </div>

          {/* Card name */}
          <div className="text-[9px] font-display font-bold text-center text-plush-100 truncate leading-tight bg-night-950/50 rounded px-0.5 -mx-0.5" title={teddy.name}>
            {teddy.name}
          </div>

          {/* Effect text */}
          {teddy.effect && (
            <div className={`text-[7px] text-center font-semibold ${style.text || 'text-plush-200'}`}>
              {teddy.effect === 'heal' && `+${teddy.amount} HP`}
              {teddy.effect === 'draw' && `Draw ${teddy.amount}`}
              {teddy.effect === 'damage' && `${teddy.amount} DMG`}
              {teddy.effect === 'buff' && `+${teddy.amount} ATK`}
            </div>
          )}

          {/* Action card stats */}
          {teddy.type === 'action' && (
            <div className="flex justify-between items-center px-1 mt-0.5">
              <div className="flex items-center gap-0.5">
                <span className="text-[10px]">⚔️</span>
                <span className="text-red-400 font-bold text-xs">{teddy.attack}</span>
              </div>
              {teddy.ability && teddy.ability !== 'none' && (
                <div className="text-[10px]" title={teddy.ability}>
                  {ABILITY_ICONS[teddy.ability] || '✨'}
                </div>
              )}
              <div className="flex items-center gap-0.5">
                {/* defense is the HP pool; show remaining HP, tinted red when wounded */}
                <span className={`font-bold text-xs ${teddy.currentHp !== undefined && teddy.currentHp < teddy.defense ? 'text-red-400' : 'text-sky-300'}`}>
                  {teddy.currentHp ?? teddy.defense}
                </span>
                <span className="text-[10px]">🛡️</span>
              </div>
            </div>
          )}

          {/* Rarity indicator */}
          {teddy.rarity && (
            <div className={`text-[6px] text-center uppercase tracking-wide font-bold ${style.text}`}>
              {teddy.rarity}
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
};

export default TeddyCard;
