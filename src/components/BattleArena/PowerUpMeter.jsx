import React from 'react';
import { Button } from "@/components/ui/button";

const PowerUpMeter = ({ powerUpMeter, onPowerUp }) => {
  return (
    <div className="mb-4">
      <h2 className="text-xl font-bold">Power-Up Meter</h2>
      <div className="w-full bg-gray-200 rounded-full h-2.5 dark:bg-gray-700">
        <div className="bg-blue-600 h-2.5 rounded-full" style={{ width: `${powerUpMeter}%` }}></div>
      </div>
      <Button 
        onClick={onPowerUp} 
        disabled={powerUpMeter < 100}
        className="mt-2"
      >
        Activate Power-Up
      </Button>
    </div>
  );
};

export default PowerUpMeter;