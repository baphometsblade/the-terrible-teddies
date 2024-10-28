import React from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Heart, Zap } from 'lucide-react';
import { TeddyCard } from '../../types/types';

interface PlayerStatsProps {
  teddy: TeddyCard;
  health: number;
  energy: number;
  isOpponent?: boolean;
}

const PlayerStats = ({ teddy, health, energy, isOpponent }: PlayerStatsProps) => {
  return (
    <motion.div
      initial={{ x: isOpponent ? 50 : -50, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      transition={{ duration: 0.5 }}
    >
      <Card>
        <CardHeader>
          <CardTitle>{teddy.name}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-2">
            <Heart className="text-red-500" />
            <Progress value={health} className="h-2" />
            <span className="text-sm font-medium">{health}%</span>
          </div>
          <div className="flex items-center gap-2">
            <Zap className="text-yellow-500" />
            <div className="flex gap-1">
              {Array.from({ length: 3 }).map((_, i) => (
                <div
                  key={i}
                  className={`w-4 h-4 rounded-full ${
                    i < energy ? 'bg-yellow-500' : 'bg-gray-300'
                  }`}
                />
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
};

export default PlayerStats;