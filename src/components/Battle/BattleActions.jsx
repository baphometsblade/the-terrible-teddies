import React from 'react';
import { Button } from "@/components/ui/button";

const BattleActions = ({ currentTurn, playerEnergy, onAction }) => {
  return (
    <div className="battle-actions mb-4">
      <Button onClick={() => onAction('attack')} disabled={currentTurn !== 'player'} className="mr-2">
        Attack
      </Button>
      <Button onClick={() => onAction('defend')} disabled={currentTurn !== 'player'} className="mr-2">
        Defend
      </Button>
      <Button onClick={() => onAction('special')} disabled={currentTurn !== 'player' || playerEnergy < 2}>
        Special Move
      </Button>
    </div>
  );
};

export default BattleActions;