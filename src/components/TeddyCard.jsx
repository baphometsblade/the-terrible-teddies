import React from 'react';
import { Card, CardContent } from "@/components/ui/card";

const TeddyCard = ({ card, onClick }) => {
  return (
    <Card className="w-24 h-32 cursor-pointer" onClick={onClick}>
      <CardContent className="p-2">
        <img src={card.url} alt={card.name} className="w-full h-16 object-cover mb-2" />
        <p className="text-xs font-bold">{card.name}</p>
        <p className="text-xs">Type: {card.type}</p>
      </CardContent>
    </Card>
  );
};

export default TeddyCard;
