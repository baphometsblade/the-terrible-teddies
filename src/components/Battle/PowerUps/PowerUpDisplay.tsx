import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Zap, Shield, Target, Flame } from 'lucide-react';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface PowerUp {
  id: string;
  name: string;
  description: string;
  type: 'attack' | 'defense' | 'special' | 'ultimate';
  cost: number;
  duration: number;
}

interface PowerUpDisplayProps {
  availablePowerUps: PowerUp[];
  onActivate: (powerUp: PowerUp) => void;
  currentEnergy: number;
}

const PowerUpDisplay: React.FC<PowerUpDisplayProps> = ({
  availablePowerUps,
  onActivate,
  currentEnergy
}) => {
  const getPowerUpIcon = (type: PowerUp['type']) => {
    switch (type) {
      case 'attack':
        return <Flame className="w-5 h-5 text-red-500" />;
      case 'defense':
        return <Shield className="w-5 h-5 text-blue-500" />;
      case 'special':
        return <Zap className="w-5 h-5 text-yellow-500" />;
      case 'ultimate':
        return <Target className="w-5 h-5 text-purple-500" />;
    }
  };

  const getPowerUpColor = (type: PowerUp['type']) => {
    switch (type) {
      case 'attack':
        return 'bg-red-100 hover:bg-red-200';
      case 'defense':
        return 'bg-blue-100 hover:bg-blue-200';
      case 'special':
        return 'bg-yellow-100 hover:bg-yellow-200';
      case 'ultimate':
        return 'bg-purple-100 hover:bg-purple-200';
    }
  };

  return (
    <div className="power-ups-container">
      <h3 className="text-lg font-bold mb-2">Power-Ups</h3>
      <div className="grid grid-cols-2 gap-2">
        <AnimatePresence>
          {availablePowerUps.map((powerUp) => (
            <motion.div
              key={powerUp.id}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
            >
              <Card className={`${getPowerUpColor(powerUp.type)} cursor-pointer`}>
                <CardContent className="p-3">
                  <div className="flex items-center gap-2 mb-1">
                    {getPowerUpIcon(powerUp.type)}
                    <span className="font-semibold">{powerUp.name}</span>
                  </div>
                  <p className="text-sm mb-2">{powerUp.description}</p>
                  <Button
                    onClick={() => onActivate(powerUp)}
                    disabled={currentEnergy < powerUp.cost}
                    className="w-full"
                    variant="outline"
                    size="sm"
                  >
                    Activate ({powerUp.cost} energy)
                  </Button>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default PowerUpDisplay;