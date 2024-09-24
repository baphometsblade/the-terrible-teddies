import React from 'react';
import { Progress } from "@/components/ui/progress";

export const PlayerArea = ({ health }) => {
  return (
    <div className="player-area bg-purple-800 p-4 rounded-lg">
      <h2 className="text-2xl font-bold text-white mb-2">Your Terrible Teddy</h2>
      <div className="flex items-center">
        <span className="text-white mr-2">HP:</span>
        <Progress value={(health / 30) * 100} className="w-full" />
        <span className="text-white ml-2">{health}/30</span>
      </div>
    </div>
  );
};