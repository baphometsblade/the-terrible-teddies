import React from 'react';
import { Button } from "@/components/ui/button";
import { Sword, Shield, Zap, Sparkles } from 'lucide-react';

const ActionButtons = ({ onAction, onPowerUp, onCombo, powerUpReady, comboReady, isDisabled }) => {
  return (
    <div className="action-buttons grid grid-cols-2 gap-2 mb-4">
      <Button 
        onClick={() => onAction('attack')}
        disabled={isDisabled}
        className="bg-red-500 hover:bg-red-600 text-white"
      >
        <Sword className="mr-2 h-4 w-4" /> Attack
      </Button>
      <Button 
        onClick={() => onAction('defend')}
        disabled={isDisabled}
        className="bg-blue-500 hover:bg-blue-600 text-white"
      >
        <Shield className="mr-2 h-4 w-4" /> Defend
      </Button>
      <Button 
        onClick={onPowerUp}
        disabled={isDisabled || !powerUpReady}
        className="bg-yellow-500 hover:bg-yellow-600 text-white"
      >
        <Zap className="mr-2 h-4 w-4" /> Power-Up
      </Button>
      <Button 
        onClick={onCombo}
        disabled={isDisabled || !comboReady}
        className="bg-purple-500 hover:bg-purple-600 text-white"
      >
        <Sparkles className="mr-2 h-4 w-4" /> Combo
      </Button>
    </div>
  );
};

export default ActionButtons;