import React from 'react';
import { motion } from 'framer-motion';
import { Progress } from '@/components/ui/progress';
import { Heart } from 'lucide-react';

export const OpponentArea = ({ hp, hand }) => {
  return (
    <div className="opponent-area mb-6 bg-gradient-to-r from-red-100 to-pink-100 p-4 rounded-lg shadow-md">
      <h2 className="text-2xl font-bold text-purple-800 mb-2">Opponent's Terrible Teddy</h2>
      <div className="flex items-center mb-2">
        <Heart className="w-6 h-6 text-red-500 mr-2" />
        <Progress value={(hp / 30) * 100} className="w-full h-4 bg-red-200" />
        <p className="text-sm ml-2 text-purple-700 font-semibold">{hp}/30</p>
      </div>
      <div className="flex space-x-2 mt-4 justify-center">
        {hand.map((_, index) => (
          <motion.div
            key={index}
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
          >
            <div className="w-16 h-24 bg-gradient-to-br from-red-300 to-pink-300 shadow-md rounded-lg"></div>
          </motion.div>
        ))}
      </div>
    </div>
  );
};