import React from 'react';
import { Button } from "@/components/ui/button";

export const PlayerHand = ({ hand, onPlayCard }) => {
  return (
    <div className="flex flex-wrap justify-center gap-4 mt-4">
      {hand.map((card) => (
        <div key={card.id} className="bg-white p-4 rounded-lg shadow-md">
          <img src={card.url} alt={card.name} className="w-32 h-32 object-cover mb-2 rounded" />
          <h3 className="font-bold">{card.name}</h3>
          <p>Cost: {card.energy_cost}</p>
          <Button onClick={() => onPlayCard(card)} className="mt-2">Play</Button>
        </div>
      ))}
    </div>
  );
};