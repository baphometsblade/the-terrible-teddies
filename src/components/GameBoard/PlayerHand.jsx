import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { motion, AnimatePresence } from 'framer-motion';

export const PlayerHand = ({ hand, onPlayCard }) => (
  <div className="flex flex-wrap justify-center gap-4 mt-4">
    <AnimatePresence>
      {hand.map((card) => (
        <motion.div
          key={card.id}
          initial={{ opacity: 0, scale: 0.8, y: 50 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.8, y: 50 }}
          whileHover={{ scale: 1.05, y: -10 }}
          whileTap={{ scale: 0.95 }}
          transition={{ duration: 0.2 }}
        >
          <Card 
            className="w-32 h-48 cursor-pointer bg-gradient-to-br from-blue-100 to-purple-100 shadow-lg hover:shadow-xl transition-all duration-200" 
            onClick={() => onPlayCard(card)}
          >
            <CardContent className="p-2 flex flex-col justify-between h-full">
              <div>
                <img src={card.url} alt={card.name} className="w-full h-20 object-cover mb-2 rounded" />
                <p className="text-sm font-bold text-purple-800">{card.name}</p>
                <p className="text-xs text-purple-600">{card.type}</p>
              </div>
              <div>
                <p className="text-xs text-purple-700">Cost: {card.energy_cost}</p>
                <p className="text-xs italic text-purple-600 truncate">{card.prompt}</p>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      ))}
    </AnimatePresence>
  </div>
);