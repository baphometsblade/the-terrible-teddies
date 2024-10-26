import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Flame, Snowflake, Leaf, Moon, Sun, Stars, Sparkles } from 'lucide-react';

interface ElementalEffectProps {
  element: 'fire' | 'ice' | 'nature' | 'dark' | 'light' | 'cosmic' | 'chaos';
  isActive: boolean;
}

const ElementalEffect: React.FC<ElementalEffectProps> = ({ element, isActive }) => {
  const getElementIcon = () => {
    switch (element) {
      case 'fire': return <Flame className="w-12 h-12 text-red-500" />;
      case 'ice': return <Snowflake className="w-12 h-12 text-blue-300" />;
      case 'nature': return <Leaf className="w-12 h-12 text-green-500" />;
      case 'dark': return <Moon className="w-12 h-12 text-purple-900" />;
      case 'light': return <Sun className="w-12 h-12 text-yellow-400" />;
      case 'cosmic': return <Stars className="w-12 h-12 text-indigo-500" />;
      case 'chaos': return <Sparkles className="w-12 h-12 text-rose-500" />;
    }
  };

  return (
    <AnimatePresence>
      {isActive && (
        <motion.div
          className="absolute inset-0 flex items-center justify-center pointer-events-none"
          initial={{ opacity: 0, scale: 0 }}
          animate={{ opacity: 1, scale: 1.5 }}
          exit={{ opacity: 0, scale: 0 }}
          transition={{ duration: 0.5 }}
        >
          <motion.div
            animate={{ 
              rotate: 360,
              scale: [1, 1.2, 1],
            }}
            transition={{ 
              duration: 2,
              repeat: Infinity,
              repeatType: "reverse"
            }}
          >
            {getElementIcon()}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default ElementalEffect;