import React from 'react';
import TeddyCard from './TeddyCard';
import { Progress } from "@/components/ui/progress";

const PlayerArea = ({ hand, hp, isOpponent, onCardPlay }) => {
  return (
    <div className={`player-area ${isOpponent ? 'bg-red-100' : 'bg-blue-100'} p-4 rounded-lg shadow-md mb-4`}>
      <h2 className="text-2xl font-bold mb-2">{isOpponent ? 'Opponent' : 'Your'} Area</h2>
      <div className="flex items-center mb-2">
        <span className="mr-2">HP:</span>
        <Progress value={(hp / 30) * 100} className="w-full" />
        <span className="ml-2">{hp}/30</span>
      </div>
      <div className="flex flex-wrap gap-2">
        {hand.map(teddy => (
          <TeddyCard 
            key={teddy.id} 
            teddy={teddy} 
            onPlay={onCardPlay}
            isPlayable={!isOpponent}
          />
        ))}
      </div>
    </div>
  );
};

export default PlayerArea;