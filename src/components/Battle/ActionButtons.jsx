import React from 'react';
import { Button } from "@/components/ui/button";

const ActionButtons = ({ onAction, isDisabled, playerStuffing }) => {
  return (
    <div className="mb-4 flex flex-wrap gap-2">
      <Button 
        onClick={() => onAction('attack')}
        disabled={isDisabled || playerStuffing < 1}
      >
        Attack (1 SP)
      </Button>
      <Button 
        onClick={() => onAction('defend')}
        disabled={isDisabled || playerStuffing < 1}
      >
        Defend (1 SP)
      </Button>
      <Button 
        onClick={() => onAction('heal')}
        disabled={isDisabled || playerStuffing < 2}
      >
        Heal (2 SP)
      </Button>
      <Button 
        onClick={() => onAction('special')}
        disabled={isDisabled || playerStuffing < 3}
      >
        Special Move (3 SP)
      </Button>
    </div>
  );
};

export default ActionButtons;