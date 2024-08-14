import React from 'react';
import { Progress } from '@/components/ui/progress';
import { Zap } from 'lucide-react';

export const GameInfo = ({ currentTurn, momentumGauge }) => (
  <div className="game-info mb-6 bg-gradient-to-r from-blue-100 to-purple-100 p-4 rounded-lg shadow-md">
    <p className="text-xl font-semibold text-purple-800 mb-2">Current Turn: {currentTurn === 'player' ? 'Your' : 'Opponent\'s'} Turn</p>
    <div className="flex items-center">
      <Zap className="w-6 h-6 text-yellow-500 mr-2" />
      <Progress value={(momentumGauge / 10) * 100} className="w-full h-4 bg-blue-200" />
      <p className="text-sm ml-2 text-purple-700 font-semibold">{momentumGauge}/10</p>
    </div>
  </div>
);