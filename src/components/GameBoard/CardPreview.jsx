import React from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent } from '@/components/ui/card';

export const CardPreview = ({ card, onClose }) => {
  if (!card) return null;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.8 }}
      className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50"
      onClick={onClose}
    >
      <Card className="w-64 bg-white rounded-lg shadow-xl" onClick={(e) => e.stopPropagation()}>
        <CardContent className="p-4">
          <img src={card.url} alt={card.name} className="w-full h-40 object-cover rounded-lg mb-2" />
          <h3 className="text-lg font-bold text-purple-800 mb-1">{card.name}</h3>
          <p className="text-sm text-purple-600 mb-1">{card.type}</p>
          <p className="text-sm text-purple-700 mb-1">Cost: {card.energy_cost}</p>
          <p className="text-sm italic text-purple-600">{card.effect}</p>
        </CardContent>
      </Card>
    </motion.div>
  );
};