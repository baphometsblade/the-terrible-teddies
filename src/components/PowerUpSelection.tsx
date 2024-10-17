import React from 'react';
import { motion } from 'framer-motion';
import { PowerUp } from '../types/types';
import { Button } from "@/components/ui/button";

interface PowerUpSelectionProps {
  powerUps: PowerUp[];
  onSelect: (powerUp: PowerUp) => void;
}

const PowerUpSelection: React.FC<PowerUpSelectionProps> = ({ powerUps, onSelect }) => {
  return (
    <motion.div
      className="power-up-selection p-4 bg-blue-100 rounded-lg shadow-lg"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <h3 className="text-xl font-bold mb-4">Choose a Power-Up</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {powerUps.map((powerUp) => (
          <Button
            key={powerUp.id}
            onClick={() => onSelect(powerUp)}
            className="bg-blue-500 hover:bg-blue-600 text-white"
          >
            {powerUp.name}
            <span className="block text-sm">{powerUp.description}</span>
          </Button>
        ))}
      </div>
    </motion.div>
  );
};

export default PowerUpSelection;