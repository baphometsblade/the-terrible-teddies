import React from 'react';
import { Button } from "@/components/ui/button";

interface GameControlsProps {
  onDrawCard: () => void;
  onEndTurn: () => void;
  isPlayerTurn: boolean;
  canDrawCard: boolean;
}

const GameControls: React.FC<GameControlsProps> = ({
  onDrawCard,
  onEndTurn,
  isPlayerTurn,
  canDrawCard,
}) => {
  return (
    <div className="game-controls">
      <Button
        onClick={onDrawCard}
        disabled={!isPlayerTurn || !canDrawCard}
        className="bg-blue-500 hover:bg-blue-600 text-white"
      >
        Draw Card
      </Button>
      <Button
        onClick={onEndTurn}
        disabled={!isPlayerTurn}
        className="bg-green-500 hover:bg-green-600 text-white"
      >
        End Turn
      </Button>
    </div>
  );
};

export default GameControls;