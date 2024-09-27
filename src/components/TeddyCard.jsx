import React from 'react';
import { Card, CardContent, CardHeader, CardFooter } from "@/components/ui/card";

const TeddyCard = ({ teddy }) => {
  return (
    <Card className="w-full bg-white shadow-lg rounded-lg overflow-hidden">
      <CardHeader>
        <h3 className="text-xl font-bold">{teddy.name}</h3>
        <p className="text-sm text-gray-600">{teddy.title}</p>
      </CardHeader>
      <CardContent>
        <img src={teddy.imageUrl} alt={teddy.name} className="w-full h-48 object-cover rounded-md mb-2" />
        <p className="text-sm mb-2">{teddy.description}</p>
        <div className="grid grid-cols-2 gap-2">
          <p>Attack: {teddy.attack}</p>
          <p>Defense: {teddy.defense}</p>
        </div>
        <p className="mt-2">Special Move: {teddy.specialMove}</p>
      </CardContent>
    </Card>
  );
};

export default TeddyCard;