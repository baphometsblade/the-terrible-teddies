import React from 'react';
import { Button } from "@/components/ui/button";

const ActionButtons = ({ onAction, onCombo, onSpecialAbility, isDisabled, comboReady, specialAbility }) => {
  return (
    <div className="action-buttons flex flex-wrap justify-center gap-2 mb-4">
      <Button 
        onClick={() => onAction('attack')}
        disabled={isDisabled}
        className="bg-red-500 hover:bg-red-600"
      >
        Attack
      </Button>
      <Button 
        onClick={() => onAction('defend')}
        disabled={isDisabled}
        className="bg-blue-500 hover:bg-blue-600"
      >
        Defend
      </Button>
      {specialAbility && (
        <Button 
          onClick={onSpecialAbility}
          disabled={isDisabled}
          className="bg-purple-500 hover:bg-purple-600"
        >
          {specialAbility.name}
        </Button>
      )}
      <Button 
        onClick={onCombo}
        disabled={isDisabled || !comboReady}
        className="bg-yellow-500 hover:bg-yellow-600"
      >
        Combo Attack
      </Button>
    </div>
  );
};

export default ActionButtons;