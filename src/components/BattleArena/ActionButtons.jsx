import React from 'react';
import { Button } from "@/components/ui/button";

const ActionButtons = ({ onAction, isDisabled }) => {
  return (
    <div className="mb-4">
      <Button 
        onClick={() => onAction('attack')}
        disabled={isDisabled}
      >
        Attack
      </Button>
      <Button 
        onClick={() => onAction('defend')}
        disabled={isDisabled}
        className="ml-2"
      >
        Defend
      </Button>
      <Button 
        onClick={() => onAction('special')}
        disabled={isDisabled}
        className="ml-2"
      >
        Special Move
      </Button>
    </div>
  );
};

export default ActionButtons;