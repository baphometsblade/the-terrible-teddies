import React from 'react';
import { motion } from 'framer-motion';
import { Button } from "@/components/ui/button";

const PowerUpSystem = ({ powerUps, onUsePowerUp }) => {
  return (
    <motion.div
      className="power-up-system bg-white p-4 rounded-lg shadow-md"
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      transition={{ duration: 0.3 }}
    >
      <h3 className="text-lg font-semibold mb-2">Power-Ups</h3>
      <div className="grid grid-cols-2 gap-2">
        {powerUps.map((powerUp, index) => (
          <Button
            key={index}
            onClick={() => onUsePowerUp(powerUp)}
            className="bg-purple-500 hover:bg-purple-600 text-white"
          >
            {powerUp.name}
          </Button>
        ))}
      </div>
    </motion.div>
  );
};

export default PowerUpSystem;