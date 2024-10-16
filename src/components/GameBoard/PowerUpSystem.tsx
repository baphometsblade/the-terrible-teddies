import React from 'react';
import { Button } from "@/components/ui/button";

interface PowerUp {
  id: string;
  name: string;
  description: string;
  effect: () => void;
}

interface PowerUpSystemProps {
  powerUps: PowerUp[];
  onUsePowerUp: (powerUp: PowerUp) => void;
}

const PowerUpSystem: React.FC<PowerUpSystemProps> = ({ powerUps, onUsePowerUp }) => {
  return (
    <div className="power-up-system">
      <h3>Power-Ups</h3>
      <div className="power-up-list">
        {powerUps.map((powerUp) => (
          <Button
            key={powerUp.id}
            onClick={() => onUsePowerUp(powerUp)}
            className="bg-purple-500 hover:bg-purple-600 text-white"
          >
            {powerUp.name}
          </Button>
        ))}
      </div>
    </div>
  );
};

export default PowerUpSystem;