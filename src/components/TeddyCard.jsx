import React from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { motion } from 'framer-motion';

/**
 * Enhanced TeddyCard component with improved visuals for different card types.
 * Shows card name, type badge, attack/defense stats, and energy cost.
 */
const TeddyCard = ({ teddy, onClick, isSelected = false, isDisabled = false }) => {
  // Card type colors
  const typeColors = {
    action: {
      bg: 'from-amber-200 to-amber-100',
      border: 'border-amber-500',
      badge: 'bg-amber-500',
      icon: '⚔️'
    },
    trap: {
      bg: 'from-purple-200 to-purple-100',
      border: 'border-purple-500',
      badge: 'bg-purple-500',
      icon: '🪤'
    },
    special: {
      bg: 'from-cyan-200 to-cyan-100',
      border: 'border-cyan-500',
      badge: 'bg-cyan-500',
      icon: '✨'
    },
  };

  const typeStyle = typeColors[teddy.type] || typeColors.action;

  // Generate a simple teddy face based on the card name
  const getTeddyFace = () => {
    if (teddy.type === 'trap') {
      return (
        <div className="text-2xl">🪤</div>
      );
    }
    if (teddy.type === 'special') {
      return (
        <div className="text-2xl">✨</div>
      );
    }
    // Action cards show teddy faces
    const faces = ['🧸', '🐻', '🐻‍❄️', '🧸'];
    const faceIndex = (teddy.id || 0) % faces.length;
    return (
      <div className="text-2xl">{faces[faceIndex]}</div>
    );
  };

  return (
    <motion.div
      whileHover={!isDisabled ? { scale: 1.05 } : {}}
      whileTap={!isDisabled ? { scale: 0.95 } : {}}
    >
      <Card
        className={`
          w-24 h-36 rounded-lg shadow-lg overflow-hidden cursor-pointer transition-all
          bg-gradient-to-b ${typeStyle.bg}
          border-2 ${typeStyle.border}
          ${isSelected ? 'ring-2 ring-yellow-400 ring-offset-2' : ''}
          ${isDisabled ? 'opacity-50 cursor-not-allowed' : 'hover:shadow-xl'}
        `}
        onClick={!isDisabled ? onClick : undefined}
      >
        <CardContent className="p-1.5 flex flex-col h-full">
          {/* Card header with cost */}
          <div className="flex justify-between items-start mb-1">
            <span className={`${typeStyle.badge} text-white text-[8px] px-1 py-0.5 rounded uppercase font-bold`}>
              {teddy.type}
            </span>
            {teddy.cost !== undefined && (
              <div className="bg-yellow-400 text-yellow-900 w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold shadow">
                {teddy.cost}
              </div>
            )}
          </div>

          {/* Card art area */}
          <div className="flex-1 flex items-center justify-center bg-white/50 rounded-lg mb-1">
            {getTeddyFace()}
          </div>

          {/* Card name */}
          <div className="text-[9px] font-bold text-center text-gray-800 truncate mb-1" title={teddy.name}>
            {teddy.name}
          </div>

          {/* Effect text for special/trap cards */}
          {teddy.effect && (
            <div className="text-[7px] text-center text-gray-600 italic mb-1">
              {teddy.effect === 'heal' && `Heal ${teddy.amount} HP`}
              {teddy.effect === 'draw' && `Draw ${teddy.amount}`}
              {teddy.effect === 'damage' && `Deal ${teddy.amount} dmg`}
            </div>
          )}

          {/* Stats footer */}
          {teddy.type === 'action' && (
            <div className="flex justify-between items-center px-1">
              <div className="flex items-center space-x-0.5">
                <span className="text-red-600 text-[10px]">⚔️</span>
                <span className="text-red-600 font-bold text-xs">{teddy.attack}</span>
              </div>
              <div className="flex items-center space-x-0.5">
                <span className="text-blue-600 text-[10px]">🛡️</span>
                <span className="text-blue-600 font-bold text-xs">{teddy.defense}</span>
              </div>
            </div>
          )}

          {/* Ability badge */}
          {teddy.ability && teddy.ability !== 'none' && (
            <div className="text-[7px] text-center bg-gray-800 text-white rounded px-1 mt-0.5">
              {teddy.ability}
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
};

export default TeddyCard;
