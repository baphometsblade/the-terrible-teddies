import React from 'react';
import { motion } from 'framer-motion';
import { Button } from "@/components/ui/button";

const PlayerHand = ({ hand, onPlayCard, isPlayerTurn, playerEnergy }) => {
  return (
    <div className="player-hand mt-4">
      <h3 className="text-xl font-bold mb-2">Your Hand</h3>
      <div className="flex space-x-2 overflow-x-auto pb-2">
        {hand.map((card) => (
          <motion.div
            key={card.id}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <Button
              onClick={() => onPlayCard(card)}
              disabled={!isPlayerTurn || playerEnergy < card.energyCost}
              className="w-24 h-32 flex flex-col items-center justify-center text-xs"
            >
              <div>{card.name}</div>
              <div>Cost: {card.energyCost}</div>
              <div>ATK: {card.attack}</div>
              <div>DEF: {card.defense}</div>
            </Button>
          </motion.div>
        ))}
      </div>
    </div>
  );
};

export default PlayerHand;