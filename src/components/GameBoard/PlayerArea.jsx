import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { motion, AnimatePresence } from 'framer-motion';
import { Shield } from 'lucide-react';

export const PlayerArea = ({ hp, hand, onPlayCard, onEndTurn, currentTurn }) => (
  <div className="player-area bg-gradient-to-r from-green-100 to-blue-100 p-4 rounded-lg shadow-md">
    <h2 className="text-2xl font-bold text-purple-800 mb-2">Your Terrible Teddy</h2>
    <div className="flex items-center mb-2">
      <Shield className="w-6 h-6 text-green-500 mr-2" />
      <Progress value={(hp / 30) * 100} className="w-full h-4 bg-green-200" />
      <p className="text-sm ml-2 text-purple-700 font-semibold">{hp}/30</p>
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
                  <p className="text-xs italic text-purple-600">{card.prompt}</p>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
    <div className="mt-6 text-center">
      <Button 
        onClick={onEndTurn} 
        disabled={currentTurn !== 'player'}
        className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white font-bold py-3 px-6 rounded-full shadow-lg transition-all duration-300 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        End Turn
      </Button>
    </div>
  </div>
);