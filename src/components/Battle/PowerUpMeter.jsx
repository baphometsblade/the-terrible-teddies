import React from 'react';
import { motion } from 'framer-motion';
import { Button } from "@/components/ui/button";

const PowerUpMeter = ({ value, onPowerUp, disabled }) => {
  return (
    <div className="power-up-meter">
      <h2 className="text-xl font-bold mb-2">Power-Up Meter</h2>
      <div className="w-full bg-gray-200 rounded-full h-2.5 dark:bg-gray-700 mb-2">
        <motion.div
          className="bg-blue-600 h-2.5 rounded-full"
          style={{ width: `${value}%` }}
          initial={{ width: 0 }}
          animate={{ width: `${value}%` }}
          transition={{ duration: 0.5 }}
        />
      </div>
      <Button 
        onClick={onPowerUp} 
        disabled={value < 100 || disabled}
        className="w-full"
      >
        Activate Power-Up
      </Button>
    </div>
  );
};

export default PowerUpMeter;