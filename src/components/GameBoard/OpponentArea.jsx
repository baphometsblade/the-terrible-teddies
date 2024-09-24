import React from 'react';
import { Progress } from '@/components/ui/progress';
import { Heart } from 'lucide-react';
import TeddyCard from '../TeddyCard';

export const OpponentArea = ({ teddies, hp }) => {
  return (
    <div className="opponent-area mb-6 bg-gradient-to-r from-red-100 to-pink-100 p-4 rounded-lg shadow-md">
      <h2 className="text-2xl font-bold text-purple-800 mb-2">Opponent's Terrible Teddy</h2>
      <div className="flex items-center mb-2">
        <Heart className="w-6 h-6 text-red-500 mr-2" />
        <Progress value={(hp / 30) * 100} className="w-full h-4 bg-red-200" />
        <p className="text-sm ml-2 text-purple-700 font-semibold">{hp}/30</p>
      </div>
      <div className="flex flex-wrap justify-center gap-4 mt-4">
        {teddies.map((teddy) => (
          <TeddyCard key={teddy.id} teddy={teddy} />
        ))}
      </div>
    </div>
  );
};
