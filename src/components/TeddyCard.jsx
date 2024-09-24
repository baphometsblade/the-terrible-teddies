import React from 'react';
import { Card, CardContent } from "@/components/ui/card";

export const TeddyCard = ({ teddy }) => {
  return (
    <Card className="w-48 bg-gray-800 border border-gray-700">
      <CardContent className="p-4">
        <h3 className="text-lg font-bold mb-2">{teddy.name}</h3>
        <p className="text-sm mb-1">Attack: {teddy.attack}</p>
        <p className="text-sm mb-1">Defense: {teddy.defense}</p>
        <p className="text-sm italic">Special: {teddy.specialMove}</p>
      </CardContent>
    </Card>
  );
};
