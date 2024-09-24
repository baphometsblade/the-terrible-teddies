import React from 'react';
import { Button } from "@/components/ui/button";
import { motion } from 'framer-motion';

export const MainMenu = ({ onScreenChange }) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="text-center"
    >
      <h1 className="text-6xl font-bold mb-8 text-center text-purple-300">Terrible Teddies</h1>
      <div className="space-y-4">
        <Button 
          onClick={() => onScreenChange('game')} 
          className="w-48 bg-red-600 hover:bg-red-700 text-white font-bold py-3 px-6 rounded-lg text-xl"
        >
          Start Game
        </Button>
        <Button 
          onClick={() => onScreenChange('deckBuilder')} 
          className="w-48 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-lg text-xl"
        >
          Deck Builder
        </Button>
        <Button 
          onClick={() => onScreenChange('cardShop')} 
          className="w-48 bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-6 rounded-lg text-xl"
        >
          Card Shop
        </Button>
      </div>
    </motion.div>
  );
};
