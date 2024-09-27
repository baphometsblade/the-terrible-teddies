import React from 'react';
import { motion } from 'framer-motion';
import { Progress } from '@/components/ui/progress';
import { Shield } from 'lucide-react';
import TeddyCard from '../TeddyCard';

export const PlayerArea = ({ teddies, hp, hand, onCardPlay, onCardClick, momentumGauge }) => {
  return (
    <div className="player-area bg-gradient-to-r from-green-100 to-blue-100 p-4 rounded-lg shadow-md">
      <h2 className="text-2xl font-bold text-purple-800 mb-2">Your Terrible Teddy</h2>
      <div className="flex items-center mb-2">
        <Shield className="w-6 h-6 text-green-500 mr-2" />
        <Progress value={(hp / 30) * 100} className="w-full h-4 bg-green-200" />
        <p className="text-sm ml-2 text-purple-700 font-semibold">{hp}/30</p>
      </div>
      <div className="flex flex-wrap justify-center gap-4 mt-4">
        {teddies.map((teddy) => (
          <TeddyCard key={teddy.id} teddy={teddy} />
        ))}
      </div>
      <div className="mt-4">
        <h3 className="text-xl font-bold text-purple-800 mb-2">Your Hand</h3>
        <div className="flex flex-wrap justify-center gap-2">
          {hand.map((card) => (
            <motion.div
              key={card.id}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => onCardClick(card)}
            >
              <TeddyCard
                teddy={card}
                isPlayable={card.energy_cost <= 10 - momentumGauge}
                onPlay={() => onCardPlay(card)}
              />
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
};