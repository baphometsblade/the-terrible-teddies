import React from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const TeddyCard = ({ teddy, onClick, isSelected, canPlay }) => {
  return (
    <Card className={`w-48 bg-gradient-to-br from-purple-100 to-pink-100 ${isSelected ? 'ring-2 ring-blue-500' : ''}`}>
      <CardContent className="p-4">
        <h3 className="text-lg font-bold mb-1 text-purple-800">{teddy.name}</h3>
        <p className="text-sm italic mb-2 text-purple-600">{teddy.title}</p>
        <p className="text-sm mb-1 text-purple-600">Attack: {teddy.attack}</p>
        <p className="text-sm mb-1 text-purple-700">Defense: {teddy.defense}</p>
        <p className="text-xs font-semibold mb-1 text-purple-800">{teddy.specialMove.name}</p>
        <p className="text-xs italic text-purple-600">{teddy.specialMove.description}</p>
        {canPlay && (
          <Button 
            onClick={() => onClick(teddy)} 
            className="mt-2 w-full bg-purple-500 hover:bg-purple-600 text-white"
          >
            Play Teddy
          </Button>
        )}
      </CardContent>
    </Card>
  );
};

export default TeddyCard;
