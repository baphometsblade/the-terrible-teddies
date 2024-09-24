import React from 'react';
import { Progress } from '@/components/ui/progress';
import { Shield } from 'lucide-react';
import { PlayerHand } from './PlayerHand';

export const PlayerArea = ({ hp, maxHp, hand, onPlayCard }) => {
  return (
    <div className="player-area bg-gradient-to-r from-green-100 to-blue-100 p-4 rounded-lg shadow-md">
      <h2 className="text-2xl font-bold text-purple-800 mb-2">Your Terrible Teddy</h2>
      <div className="flex items-center mb-2">
        <Shield className="w-6 h-6 text-green-500 mr-2" />
        <Progress value={(hp / maxHp) * 100} className="w-full h-4 bg-green-200" />
        <p className="text-sm ml-2 text-purple-700 font-semibold">{hp}/{maxHp}</p>
      </div>
      <PlayerHand cards={hand} onPlayCard={onPlayCard} />
    </div>
  );
};