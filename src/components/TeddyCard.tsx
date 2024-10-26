import React, { useState } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TeddyCard as TeddyCardType } from '../types/types';
import { getPlaceholderImage, getBearMetadata, getRarityColor, getElementColor, getRarityBorder } from '../utils/bearPlaceholders';
import { motion, AnimatePresence } from 'framer-motion';
import { Flame, Snowflake, Leaf, Moon, Sun, Stars, Sparkles } from 'lucide-react';

interface TeddyCardProps {
  teddy: TeddyCardType;
  onClick?: () => void;
  onSpecialAbility?: () => void;
}

const ElementIcon = ({ element }: { element?: string }) => {
  switch (element) {
    case 'fire':
      return <Flame className="w-3 h-3" />;
    case 'ice':
      return <Snowflake className="w-3 h-3" />;
    case 'nature':
      return <Leaf className="w-3 h-3" />;
    case 'dark':
      return <Moon className="w-3 h-3" />;
    case 'light':
      return <Sun className="w-3 h-3" />;
    case 'cosmic':
      return <Stars className="w-3 h-3" />;
    case 'chaos':
      return <Sparkles className="w-3 h-3" />;
    default:
      return null;
  }
};

const TeddyCard: React.FC<TeddyCardProps> = ({ teddy, onClick, onSpecialAbility }) => {
  const metadata = getBearMetadata(teddy.id);
  const imageUrl = teddy.image_url || getPlaceholderImage(teddy.id);
  const [isHovered, setIsHovered] = useState(false);

  return (
    <motion.div
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      onHoverStart={() => setIsHovered(true)}
      onHoverEnd={() => setIsHovered(false)}
    >
      <Card 
        className={`w-32 h-48 bg-white rounded-lg shadow-lg overflow-hidden cursor-pointer relative border-2 ${
          metadata ? getRarityBorder(metadata.rarity) : 'border-gray-300'
        }`}
        onClick={onClick}
      >
        <CardContent className="p-2 flex flex-col items-center justify-between h-full">
          <div className="text-xs font-bold truncate w-full text-center flex items-center justify-center gap-1">
            <span className={metadata ? getRarityColor(metadata.rarity) : ''}>{teddy.name}</span>
            {metadata?.element && (
              <motion.span 
                className={getElementColor(metadata.element)}
                animate={{ rotate: [0, 360] }}
                transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
              >
                <ElementIcon element={metadata.element} />
              </motion.span>
            )}
          </div>
          <motion.div 
            className="w-20 h-20 rounded-lg mb-1 bg-center bg-cover transform"
            style={{ 
              backgroundImage: `url(${imageUrl})`,
              backgroundPosition: 'center',
              backgroundSize: 'cover'
            }}
            whileHover={{ scale: 1.1 }}
          />
          <div className="flex justify-between w-full text-xs">
            <span className="text-red-500">⚔️ {teddy.attack}</span>
            <span className="text-blue-500">🛡️ {teddy.defense}</span>
          </div>
          {onSpecialAbility && (
            <Button 
              className="mt-1 text-xs p-1 w-full" 
              onClick={(e) => {
                e.stopPropagation();
                onSpecialAbility();
              }}
              variant="secondary"
            >
              {teddy.specialAbility.name}
            </Button>
          )}
        </CardContent>
        <AnimatePresence>
          {isHovered && metadata && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className="absolute inset-0 bg-black bg-opacity-80 p-2 text-white text-xs"
            >
              <p className="font-bold mb-1">{metadata.title}</p>
              <p className="text-xs mb-1">{metadata.description}</p>
              <p className="text-xs text-yellow-400">
                {metadata.specialMove}: {metadata.specialMoveDescription}
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </Card>
    </motion.div>
  );
};

export default TeddyCard;
