import React from 'react';
import { Card, CardContent } from "@/components/ui/card";

const TeddyCard = ({ teddy }) => {
  return (
    <Card className="w-48 bg-gradient-to-br from-purple-100 to-pink-100">
      <CardContent className="p-4">
        <h3 className="text-lg font-bold mb-1 text-purple-800">{teddy.name}</h3>
        <p className="text-sm mb-1 text-purple-600">Attack: {teddy.attack}</p>
        <p className="text-sm mb-1 text-purple-700">Defense: {teddy.defense}</p>
        <p className="text-xs italic text-purple-600">{teddy.specialMove}</p>
      </CardContent>
    </Card>
  );
};

export default TeddyCard;
