import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const TeddyCard = ({ teddy, onSelect }) => {
  return (
    <Card className="w-64 cursor-pointer" onClick={() => onSelect(teddy)}>
      <CardHeader>
        <CardTitle>{teddy.name}</CardTitle>
        <p className="text-sm text-gray-500">{teddy.title}</p>
      </CardHeader>
      <CardContent>
        <img src={teddy.image_url} alt={teddy.name} className="w-full h-40 object-cover mb-2 rounded" />
        <p className="text-sm mb-2">{teddy.description}</p>
        <div className="flex justify-between">
          <span>Attack: {teddy.attack}</span>
          <span>Defense: {teddy.defense}</span>
        </div>
        <p className="mt-2">Special: {teddy.special_move}</p>
      </CardContent>
    </Card>
  );
};

export default TeddyCard;