import React from 'react';
import { Progress } from '@/components/ui/progress';
import { Card } from '@/components/ui/card';
import { motion, AnimatePresence } from 'framer-motion';
import { Heart, Zap } from 'lucide-react';

export const OpponentArea = ({ hp, hand, energy, darkMode }) => (
  <div className={`opponent-area mb-6 p-4 rounded-lg shadow-md ${
    darkMode ? 'bg-gray-700' : 'bg-gradient-to-r from-red-100 to-pink-100'
  }`}>
    <h2 className={`text-2xl font-bold mb-2 ${darkMode ? 'text-white' : 'text-purple-800'}`}>Opponent's Terrible Teddy</h2>
    <div className="flex items-center mb-2">
      <Heart className={`w-6 h-6 mr-2 ${darkMode ? 'text-red-400' : 'text-red-500'}`} />
      <Progress value={(hp / 30) * 100} className={`w-full h-4 ${darkMode ? 'bg-red-900' : 'bg-red-200'}`} />
      <p className={`text-sm ml-2 font-semibold ${darkMode ? 'text-red-400' : 'text-purple-700'}`}>{hp}/30</p>
    </div>
    <div className="flex items-center mb-4">
      <Zap className={`w-6 h-6 mr-2 ${darkMode ? 'text-yellow-400' : 'text-yellow-500'}`} />
      <Progress value={(energy / 10) * 100} className={`w-full h-4 ${darkMode ? 'bg-yellow-900' : 'bg-yellow-200'}`} />
      <p className={`text-sm ml-2 font-semibold ${darkMode ? 'text-yellow-400' : 'text-purple-700'}`}>{energy}/10</p>
    </div>
    <div className="flex space-x-2 mt-4 justify-center">
      <AnimatePresence>
        {hand.map((_, index) => (
          <motion.div
            key={index}
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
          >
            <Card className={`w-16 h-24 shadow-md transform hover:scale-105 transition-transform duration-200 ${
              darkMode ? 'bg-gradient-to-br from-gray-600 to-gray-800' : 'bg-gradient-to-br from-red-300 to-pink-300'
            }`}></Card>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  </div>
);