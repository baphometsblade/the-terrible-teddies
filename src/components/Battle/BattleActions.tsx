import React from 'react';
import { Button } from "@/components/ui/button";
import { Shield, Sword, Zap } from 'lucide-react';

interface BattleActionsProps {
  onAction: (action: 'attack' | 'defend' | 'special') => void;
  isPlayerTurn: boolean;
  isAnimating: boolean;
  playerEnergy: number;
}

const BattleActions = ({ onAction, isPlayerTurn, isAnimating, playerEnergy }: BattleActionsProps) => {
  return (
    <div className="mt-8">
      <div className="flex justify-center gap-4">
        <Button
          onClick={() => onAction('attack')}
          disabled={!isPlayerTurn || isAnimating}
          className="flex items-center gap-2"
        >
          <Sword className="w-4 h-4" />
          Attack
        </Button>
        <Button
          onClick={() => onAction('defend')}
          disabled={!isPlayerTurn || isAnimating}
          className="flex items-center gap-2"
        >
          <Shield className="w-4 h-4" />
          Defend
        </Button>
        <Button
          onClick={() => onAction('special')}
          disabled={!isPlayerTurn || isAnimating || playerEnergy < 2}
          className="flex items-center gap-2"
        >
          <Zap className="w-4 h-4" />
          Special
        </Button>
      </div>
    </div>
  );
};

export default BattleActions;