import React from 'react';
import { Card, CardContent, CardHeader } from "@/components/ui/card";

const TeddyCard = ({ teddy, isSelected, onSelect }) => {
  return (
    <Card 
      className={`w-48 cursor-pointer transition-all duration-300 ${
        isSelected ? 'ring-4 ring-yellow-400' : ''
      }`}
      onClick={onSelect}
    >
      <CardHeader className="p-2">
        <h3 className="text-lg font-bold">{teddy.name}</h3>
        <p className="text-sm text-gray-500">{teddy.title}</p>
      </CardHeader>
      <CardContent className="p-2">
        <img src={teddy.imageUrl} alt={teddy.name} className="w-full h-32 object-cover mb-2 rounded" />
        <p className="text-sm">Attack: {teddy.attack}</p>
        <p className="text-sm">Defense: {teddy.defense}</p>
        <p className="text-sm">Special: {teddy.specialMove}</p>
      </CardContent>
    </Card>
  );
};

export default TeddyCard;