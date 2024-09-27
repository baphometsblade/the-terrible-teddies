import React from 'react';
import { Card, CardContent, CardHeader, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const TeddyCard = ({ bear, onSelect }) => {
  return (
    <Card className="bg-purple-700 text-white">
      <CardHeader>
        <h3 className="text-lg font-semibold">{bear.name}</h3>
        <p className="text-sm text-purple-300">{bear.title}</p>
      </CardHeader>
      <CardContent>
        <img src={bear.imageUrl} alt={bear.name} className="w-full h-32 object-cover mb-2 rounded" />
        <p className="text-sm mb-2">{bear.description}</p>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <p>Attack: {bear.attack}</p>
          <p>Defense: {bear.defense}</p>
        </div>
      </CardContent>
      <CardFooter>
        <Button onClick={() => onSelect(bear)} className="w-full">
          Select
        </Button>
      </CardFooter>
    </Card>
  );
};

export default TeddyCard;