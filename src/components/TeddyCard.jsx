import React from 'react';
import { Card, CardContent, CardHeader, CardFooter } from "@/components/ui/card";

const TeddyCard = ({ teddy }) => {
  return (
    <Card className="w-64">
      <CardHeader>
        <h3 className="text-xl font-bold">{teddy.name}</h3>
        <p className="text-sm text-gray-500">{teddy.title}</p>
      </CardHeader>
      <CardContent>
        <p>Attack: {teddy.attack}</p>
        <p>Defense: {teddy.defense}</p>
        <p>Special Move: {teddy.specialMove}</p>
      </CardContent>
    </Card>
  );
};

export default TeddyCard;