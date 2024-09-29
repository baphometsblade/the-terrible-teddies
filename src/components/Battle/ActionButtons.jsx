import React from 'react';
import { Button } from "@/components/ui/button";

const ActionButtons = ({ onAction, isDisabled, playerEnergy }) => {
  return (
    <div className="mb-4">
      <Button 
        onClick={() => onAction('attack')}
        disabled={isDisabled}
        className="mr-2"
      >
        Attack
      </Button>
      <Button 
        onClick={() => onAction('defend')}
        disabled={isDisabled}
        className="mr-2"
      >
        Defend
      </Button>
      <Button 
        onClick={() => onAction('special')}
        disabled={isDisabled || playerEnergy < 2}
      >
        Special Move
      </Button>
    </div>
  );
};

export default ActionButtons;