import React from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';

export const CardDetail = ({ card, onClose }) => {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.8 }}
      className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50"
    >
      <Card className="w-80 bg-white rounded-lg shadow-xl">
        <CardContent className="p-4">
          {onClose && (
            <Button
              onClick={onClose}
              variant="ghost"
              className="absolute top-2 right-2"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
          <img src={card.url} alt={card.name} className="w-full h-48 object-cover rounded-lg mb-4" />
          <h3 className="text-xl font-bold text-purple-800 mb-2">{card.name}</h3>
          <p className="text-sm text-purple-600 mb-2">{card.type}</p>
          <p className="text-sm text-purple-700 mb-2">Cost: {card.energy_cost}</p>
          <p className="text-sm italic text-purple-600">{card.effect}</p>
        </CardContent>
      </Card>
    </motion.div>
  );
};