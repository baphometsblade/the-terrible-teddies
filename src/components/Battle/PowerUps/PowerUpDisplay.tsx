import React from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Zap, Shield, Swords } from 'lucide-react';

interface PowerUp {
  id: string;
  name: string;
  description: string;
  type: 'attack' | 'defense' | 'special';
  value: number;
}

interface PowerUpDisplayProps {
  availablePowerUps: PowerUp[];
  onUsePowerUp: (powerUp: PowerUp) => void;
}

const PowerUpDisplay: React.FC<PowerUpDisplayProps> = ({ availablePowerUps, onUsePowerUp }) => {
  const getPowerUpIcon = (type: string) => {
    switch (type) {
      case 'attack': return <Swords className="w-5 h-5 text-red-500" />;
      case 'defense': return <Shield className="w-5 h-5 text-blue-500" />;
      case 'special': return <Zap className="w-5 h-5 text-yellow-500" />;
    }
  };

  return (
    <div className="grid grid-cols-3 gap-2">
      {availablePowerUps.map((powerUp) => (
        <motion.div
          key={powerUp.id}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          <Card className="bg-gradient-to-br from-gray-900/5 to-gray-900/10">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                {getPowerUpIcon(powerUp.type)}
                <h4 className="font-bold text-sm">{powerUp.name}</h4>
              </div>
              <p className="text-xs text-gray-600 mb-2">{powerUp.description}</p>
              <Button 
                onClick={() => onUsePowerUp(powerUp)}
                className="w-full"
                size="sm"
              >
                Use Power-Up
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      ))}
    </div>
  );
};

export default PowerUpDisplay;