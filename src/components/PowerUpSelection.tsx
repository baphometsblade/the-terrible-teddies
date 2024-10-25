import React from 'react';
import { motion } from 'framer-motion';
import { PowerUp } from '../types/types';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Zap, Shield, Swords } from 'lucide-react';

interface PowerUpSelectionProps {
  powerUps: PowerUp[];
  onSelect: (powerUp: PowerUp) => void;
}

const PowerUpSelection: React.FC<PowerUpSelectionProps> = ({ powerUps, onSelect }) => {
  const getIcon = (powerUp: PowerUp) => {
    switch (powerUp.type) {
      case 'attack':
        return <Swords className="w-6 h-6 text-red-500" />;
      case 'defense':
        return <Shield className="w-6 h-6 text-blue-500" />;
      default:
        return <Zap className="w-6 h-6 text-yellow-500" />;
    }
  };

  return (
    <div className="power-up-selection">
      <h3 className="text-xl font-bold mb-4">Choose Your Power-Up</h3>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {powerUps.map((powerUp, index) => (
          <motion.div
            key={powerUp.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.2 }}
          >
            <Card
              className="cursor-pointer hover:shadow-lg transition-shadow"
              onClick={() => onSelect(powerUp)}
            >
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  {getIcon(powerUp)}
                  {powerUp.name}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600">{powerUp.description}</p>
                <div className="mt-2 text-sm">
                  {powerUp.stats && Object.entries(powerUp.stats).map(([key, value]) => (
                    <div key={key} className="flex justify-between">
                      <span className="capitalize">{key}:</span>
                      <span className={value > 0 ? 'text-green-500' : 'text-red-500'}>
                        {value > 0 ? `+${value}` : value}
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>
    </div>
  );
};

export default PowerUpSelection;