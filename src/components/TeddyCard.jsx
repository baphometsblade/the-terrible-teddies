import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const TeddyCard = ({ teddy }) => {
  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle>{teddy.name}</CardTitle>
        <p className="text-sm text-gray-500">{teddy.title}</p>
      </CardHeader>
      <CardContent>
        <p className="mb-2">{teddy.description}</p>
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