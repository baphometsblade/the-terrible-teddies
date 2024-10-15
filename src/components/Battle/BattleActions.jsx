import React from 'react';
import { motion } from 'framer-motion';
import { Sword, Shield, Zap, Sparkles } from 'lucide-react';
import { Button } from "@/components/ui/button";

const BattleActions = ({ currentTurn, playerEnergy, rage, onAction, disabled }) => {
  const buttonVariants = {
    disabled: { opacity: 0.5, scale: 0.95 },
    enabled: { opacity: 1, scale: 1 },
  };

  return (
    <div className="battle-actions grid grid-cols-2 gap-2 mb-4">
      <motion.div
        variants={buttonVariants}
        animate={(currentTurn === 'player' && !disabled) ? 'enabled' : 'disabled'}
      >
        <Button 
          onClick={() => onAction('attack')} 
          disabled={currentTurn !== 'player' || disabled}
          className="w-full bg-red-500 hover:bg-red-600"
        >
          <Sword className="mr-2 h-4 w-4" /> Attack
        </Button>
      </motion.div>
      <motion.div
        variants={buttonVariants}
        animate={(currentTurn === 'player' && !disabled) ? 'enabled' : 'disabled'}
      >
        <Button 
          onClick={() => onAction('defend')} 
          disabled={currentTurn !== 'player' || disabled}
          className="w-full bg-blue-500 hover:bg-blue-600"
        >
          <Shield className="mr-2 h-4 w-4" /> Defend
        </Button>
      </motion.div>
      <motion.div
        variants={buttonVariants}
        animate={(currentTurn === 'player' && playerEnergy >= 2 && !disabled) ? 'enabled' : 'disabled'}
      >
        <Button 
          onClick={() => onAction('special')} 
          disabled={currentTurn !== 'player' || playerEnergy < 2 || disabled}
          className="w-full bg-purple-500 hover:bg-purple-600"
        >
          <Zap className="mr-2 h-4 w-4" /> Special Move
        </Button>
      </motion.div>
      <motion.div
        variants={buttonVariants}
        animate={(currentTurn === 'player' && rage === 100 && !disabled) ? 'enabled' : 'disabled'}
      >
        <Button 
          onClick={() => onAction('ultimate')} 
          disabled={currentTurn !== 'player' || rage < 100 || disabled}
          className={`w-full bg-yellow-500 hover:bg-yellow-600 ${rage === 100 ? 'animate-pulse' : ''}`}
        >
          <Sparkles className="mr-2 h-4 w-4" /> Ultimate Move
        </Button>
      </motion.div>
    </div>
  );
};

export default BattleActions;