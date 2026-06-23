import { Card, CardContent } from "@/components/ui/card";
import { motion } from 'framer-motion';

const RARITY_STYLES = {
  common: {
    bg: 'from-gray-200 to-gray-100',
    border: 'border-gray-400',
    badge: 'bg-gray-500',
    textColor: 'text-gray-700',
  },
  uncommon: {
    bg: 'from-green-200 to-green-100',
    border: 'border-green-500',
    badge: 'bg-green-500',
    textColor: 'text-green-700',
  },
  rare: {
    bg: 'from-blue-200 to-blue-100',
    border: 'border-blue-500',
    badge: 'bg-blue-500',
    textColor: 'text-blue-700',
  },
  epic: {
    bg: 'from-purple-200 to-purple-100',
    border: 'border-purple-500',
    badge: 'bg-purple-500',
    textColor: 'text-purple-700',
  },
  legendary: {
    bg: 'from-yellow-200 via-orange-100 to-yellow-200',
    border: 'border-yellow-500',
    badge: 'bg-gradient-to-r from-yellow-500 to-orange-500',
    textColor: 'text-orange-700',
  },
};

const TYPE_STYLES = {
  action: { bg: 'from-amber-200 to-amber-100', border: 'border-amber-500', badge: 'bg-amber-500' },
  trap: { bg: 'from-purple-200 to-purple-100', border: 'border-purple-500', badge: 'bg-purple-500' },
  special: { bg: 'from-cyan-200 to-cyan-100', border: 'border-cyan-500', badge: 'bg-cyan-500' },
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

const TeddyCard = ({ teddy, onClick, isSelected = false, isDisabled = false }) => {
  // Use rarity style if available, otherwise fall back to type style
  const rarityStyle = teddy.rarity ? RARITY_STYLES[teddy.rarity] : null;
  const typeStyle = TYPE_STYLES[teddy.type] || TYPE_STYLES.action;
  const style = rarityStyle || typeStyle;

  const getTeddyEmoji = () => {
    if (teddy.type === 'trap') return '🪤';
    if (teddy.type === 'special') return '✨';

    const rarityEmojis = {
      legendary: ['👑', '🌟'],
      epic: ['🐻‍❄️', '💜'],
      rare: ['🐻', '🔷'],
      uncommon: ['🧸', '💚'],
      common: ['🧸', '🐻'],
    };
    const options = rarityEmojis[teddy.rarity] || ['🧸', '🐻'];
    return options[(teddy.id || 0) % options.length];
  };

  return (
    <motion.div
      whileHover={!isDisabled ? { scale: 1.03 } : {}}
      whileTap={!isDisabled ? { scale: 0.97 } : {}}
    >
      <Card
        className={`
          w-24 h-36 rounded-lg shadow-lg overflow-hidden cursor-pointer transition-all relative
          bg-gradient-to-b ${style.bg}
          border-2 ${style.border}
          ${isSelected ? 'ring-2 ring-yellow-400 ring-offset-2' : ''}
          ${isDisabled ? 'opacity-50 cursor-not-allowed' : 'hover:shadow-xl'}
        `}
        onClick={!isDisabled ? onClick : undefined}
      >
        {/* Legendary shine effect */}
        {teddy.rarity === 'legendary' && (
          <div className="absolute inset-0 bg-gradient-to-br from-transparent via-yellow-400/20 to-transparent pointer-events-none animate-pulse" />
        )}

        <CardContent className="p-1.5 flex flex-col h-full relative">
          {/* Cost badge top-right */}
          {teddy.cost !== undefined && (
            <div className="absolute top-0 right-0 bg-yellow-400 text-yellow-900 w-6 h-6 rounded-bl-lg flex items-center justify-center text-xs font-bold shadow border-l border-b border-yellow-500">
              {teddy.cost}
            </div>
          )}

          {/* Type badge */}
          <div className={`${style.badge} text-white text-[7px] px-1 py-0.5 rounded uppercase font-bold self-start`}>
            {teddy.type}
          </div>

          {/* Card art */}
          <div className="flex-1 flex items-center justify-center my-1">
            <div className="text-3xl">{getTeddyEmoji()}</div>
          </div>

          {/* Card name */}
          <div className="text-[9px] font-bold text-center text-gray-800 truncate leading-tight" title={teddy.name}>
            {teddy.name}
          </div>

          {/* Effect text */}
          {teddy.effect && (
            <div className={`text-[7px] text-center font-semibold ${style.textColor}`}>
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
                <span className="text-red-600 font-bold text-xs">{teddy.attack}</span>
              </div>
              {teddy.ability && teddy.ability !== 'none' && (
                <div className="text-[10px]" title={teddy.ability}>
                  {ABILITY_ICONS[teddy.ability] || '✨'}
                </div>
              )}
              <div className="flex items-center gap-0.5">
                <span className="text-blue-600 font-bold text-xs">{teddy.defense}</span>
                <span className="text-[10px]">🛡️</span>
              </div>
            </div>
          )}

          {/* Rarity indicator */}
          {teddy.rarity && (
            <div className={`text-[6px] text-center uppercase tracking-wide font-bold ${style.textColor}`}>
              {teddy.rarity}
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
};

export default TeddyCard;
