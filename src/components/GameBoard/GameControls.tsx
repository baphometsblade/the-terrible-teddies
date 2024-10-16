import React from 'react';
import { Button } from "@/components/ui/button";
import { motion } from 'framer-motion';

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
    <motion.div 
      className="game-controls flex justify-center space-x-4 mt-4"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
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
    </motion.div>
  );
};

export default GameControls;