import React from 'react';
import TeddyCard from './TeddyCard';
import { Progress } from "@/components/ui/progress";

const PlayerArea = ({ teddy, isPlayer, hp }) => {
  return (
    <div className={`player-area ${isPlayer ? 'bg-blue-100' : 'bg-red-100'} p-4 rounded-lg shadow-md mb-4`}>
      <h2 className="text-2xl font-bold mb-2">{isPlayer ? 'Your' : 'Opponent'} Teddy</h2>
      <TeddyCard teddy={teddy} />
      <div className="mt-4">
        <p className="font-bold mb-2">Health: {hp}/30</p>
        <Progress value={(hp / 30) * 100} className="w-full" />
      </div>
    </div>
  );
};

export default PlayerArea;