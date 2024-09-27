import React from 'react';
import { Card, CardContent, CardHeader } from "@/components/ui/card";

const TeddyCard = ({ teddy }) => {
  return (
    <Card className="w-full">
      <CardHeader>
        <h3 className="text-lg font-bold">{teddy.name}</h3>
        <p className="text-sm text-gray-500">{teddy.title}</p>
      </CardHeader>
      <CardContent>
        <img src={teddy.imageUrl} alt={teddy.name} className="w-full h-32 object-cover mb-2 rounded" />
        <p>Attack: {teddy.attack}</p>
        <p>Defense: {teddy.defense}</p>
        <p>Special Move: {teddy.specialMove}</p>
      </CardContent>
    </Card>
  );
};

export default TeddyCard;