import React from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';

const specialMoves = [
  { name: "Teddy Tornado", description: "Deal 5 damage to all opponent's cards" },
  { name: "Fluff Armor", description: "Gain 5 defense points" },
  { name: "Cuddle Heal", description: "Restore 5 HP" },
];

export const SpecialMoveModal = ({ onClose, onSelectMove }) => {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
    >
      <motion.div
        initial={{ scale: 0.9, y: 50 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.9, y: 50 }}
        className="bg-white p-8 rounded-lg shadow-xl max-w-md w-full"
      >
        <h2 className="text-2xl font-bold mb-4 text-purple-800">Choose Your Special Move</h2>
        <div className="space-y-4">
          {specialMoves.map((move) => (
            <Button
              key={move.name}
              onClick={() => onSelectMove(move.name)}
              className="w-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white"
            >
              <div className="text-left">
                <div className="font-bold">{move.name}</div>
                <div className="text-sm">{move.description}</div>
              </div>
            </Button>
          ))}
        </div>
        <Button onClick={onClose} className="mt-4 w-full bg-gray-300 hover:bg-gray-400 text-gray-800">
          Cancel
        </Button>
      </motion.div>
    </motion.div>
  );
};