import React from 'react';
import { Card, CardContent } from "@/components/ui/card";

export const CardDisplay = ({ cards }) => {
  return (
    <div className="card-display flex flex-wrap justify-center gap-4 my-4">
      {cards.map((card) => (
        <Card key={card.id} className="w-32 bg-purple-100">
          <CardContent className="p-4">
            <h3 className="text-lg font-bold mb-2">{card.name}</h3>
            <p className="text-sm">Attack: {card.attack}</p>
            <p className="text-sm">Defense: {card.defense}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};