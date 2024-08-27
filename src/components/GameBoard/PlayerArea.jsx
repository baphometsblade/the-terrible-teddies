import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { motion, AnimatePresence } from 'framer-motion';
import { Shield, Zap } from 'lucide-react';

export const PlayerArea = ({ hp, hand, onPlayCard, currentTurn, energy, darkMode }) => (
  <div className={`player-area p-4 rounded-lg shadow-md ${darkMode ? 'bg-gray-700' : 'bg-gradient-to-r from-green-100 to-blue-100'}`}>
    <h2 className={`text-2xl font-bold mb-2 ${darkMode ? 'text-white' : 'text-purple-800'}`}>Your Terrible Teddy</h2>
    <div className="flex items-center mb-2">
      <Shield className={`w-6 h-6 mr-2 ${darkMode ? 'text-green-400' : 'text-green-500'}`} />
      <Progress value={(hp / 30) * 100} className={`w-full h-4 ${darkMode ? 'bg-green-900' : 'bg-green-200'}`} />
      <p className={`text-sm ml-2 font-semibold ${darkMode ? 'text-green-400' : 'text-purple-700'}`}>{hp}/30</p>
    </div>
    <div className="flex items-center mb-4">
      <Zap className={`w-6 h-6 mr-2 ${darkMode ? 'text-yellow-400' : 'text-yellow-500'}`} />
      <Progress value={(energy / 10) * 100} className={`w-full h-4 ${darkMode ? 'bg-yellow-900' : 'bg-yellow-200'}`} />
      <p className={`text-sm ml-2 font-semibold ${darkMode ? 'text-yellow-400' : 'text-purple-700'}`}>{energy}/10</p>
    </div>
    <div className="flex flex-wrap justify-center gap-4 mt-4">
      <AnimatePresence>
        {hand.map((card) => (
          <motion.div
            key={card.id}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            transition={{ duration: 0.2 }}
          >
            <Card 
              className={`w-32 h-48 cursor-pointer shadow-lg hover:shadow-xl transition-all duration-200 ${
                darkMode 
                  ? 'bg-gradient-to-br from-gray-600 to-gray-800' 
                  : 'bg-gradient-to-br from-blue-100 to-purple-100'
              }`}
              onClick={() => onPlayCard(card)}
            >
              <CardContent className="p-2 flex flex-col justify-between h-full">
                <div>
                  <img src={card.url} alt={card.name} className="w-full h-20 object-cover mb-2 rounded" />
                  <p className={`text-sm font-bold ${darkMode ? 'text-white' : 'text-purple-800'}`}>{card.name}</p>
                  <p className={`text-xs ${darkMode ? 'text-gray-300' : 'text-purple-600'}`}>{card.type}</p>
                </div>
                <div>
                  <p className={`text-xs ${darkMode ? 'text-yellow-400' : 'text-purple-700'}`}>Cost: {card.energy_cost}</p>
                  <p className={`text-xs italic ${darkMode ? 'text-gray-400' : 'text-purple-600'}`}>{card.prompt}</p>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  </div>
);