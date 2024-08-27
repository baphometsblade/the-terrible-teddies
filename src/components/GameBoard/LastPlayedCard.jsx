import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { motion } from 'framer-motion';

export const LastPlayedCard = ({ card }) => (
  <div className="w-1/2 pr-2">
    {card && (
      <motion.div 
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.8 }}
        className="last-played-card bg-gradient-to-r from-yellow-100 to-orange-100 p-4 rounded-lg shadow-md"
      >
        <h3 className="text-lg font-semibold text-purple-800 mb-2">Last Played Card</h3>
        <Card className="w-32 h-48 mx-auto bg-gradient-to-br from-yellow-200 to-orange-200 shadow-lg">
          <CardContent className="p-2 flex flex-col justify-between h-full">
            <div>
              <img src={card.url} alt={card.name} className="w-full h-20 object-cover mb-2 rounded" />
              <p className="text-sm font-bold text-purple-800">{card.name}</p>
              <p className="text-xs text-purple-600">{card.type}</p>
            </div>
            <div>
              <p className="text-xs text-purple-700">Cost: {card.energy_cost}</p>
              <p className="text-xs italic text-purple-600">{card.prompt}</p>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    )}
  </div>
);