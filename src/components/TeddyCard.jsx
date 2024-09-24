import React from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export const TeddyCard = ({ teddy, onClick }) => {
  return (
    <Card className="w-48 bg-white border border-gray-300 shadow-md hover:shadow-lg transition-shadow duration-300">
      <CardContent className="p-4">
        <img src={teddy.url} alt={teddy.name} className="w-full h-32 object-cover rounded mb-2" />
        <h3 className="text-lg font-bold mb-1">{teddy.name}</h3>
        <p className="text-sm mb-1">Type: {teddy.type}</p>
        <p className="text-sm mb-1">Energy Cost: {teddy.energy_cost}</p>
        <p className="text-xs italic mb-2">{teddy.effect}</p>
        <Button onClick={onClick} className="w-full">Play Card</Button>
      </CardContent>
    </Card>
  );
};
