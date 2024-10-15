import React from 'react';
import { Button } from "@/components/ui/button";

const BattleActions = ({ currentTurn, playerEnergy, rage, onAction }) => {
  return (
    <div className="battle-actions mb-4">
      <Button onClick={() => onAction('attack')} disabled={currentTurn !== 'player'} className="mr-2">
        Attack
      </Button>
      <Button onClick={() => onAction('defend')} disabled={currentTurn !== 'player'} className="mr-2">
        Defend
      </Button>
      <Button onClick={() => onAction('special')} disabled={currentTurn !== 'player' || playerEnergy < 2} className="mr-2">
        Special Move
      </Button>
      <Button 
        onClick={() => onAction('ultimate')} 
        disabled={currentTurn !== 'player' || rage < 100}
        className={`mr-2 ${rage === 100 ? 'animate-pulse bg-red-500' : ''}`}
      >
        Ultimate Move
      </Button>
    </div>
  );
};

export default BattleActions;