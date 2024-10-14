import React from 'react';
import { motion } from 'framer-motion';
import { Button } from "@/components/ui/button";

const ComboMeter = ({ comboMeter, onCombo }) => {
  return (
    <div className="combo-meter">
      <h2 className="text-xl font-bold mb-2">Combo Meter</h2>
      <div className="w-full bg-gray-200 rounded-full h-2.5 dark:bg-gray-700 mb-2">
        <motion.div
          className="bg-green-600 h-2.5 rounded-full"
          style={{ width: `${comboMeter}%` }}
          initial={{ width: 0 }}
          animate={{ width: `${comboMeter}%` }}
          transition={{ duration: 0.5 }}
        />
      </div>
      <Button 
        onClick={onCombo} 
        disabled={comboMeter < 100}
        className="w-full"
      >
        Activate Combo
      </Button>
    </div>
  );
};

export default ComboMeter;