import React from 'react';
import { Button } from "@/components/ui/button";

const PlayerHand = ({ hand, onPlayCard, isPlayerTurn, playerStuffing }) => {
  return (
    <div className="player-hand mt-4">
      <h3 className="text-xl font-bold mb-2">Your Hand</h3>
      <div className="flex space-x-2">
        {hand.map(card => (
          <Button
            key={card.id}
            onClick={() => onPlayCard('playCard', card.id)}
            disabled={!isPlayerTurn || playerStuffing < card.stuffingCost}
          >
            {card.name} ({card.stuffingCost} SP)
          </Button>
        ))}
      </div>
    </div>
  );
};

export default PlayerHand;