import React from 'react';
import { Card, CardContent, CardHeader, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import TeddySprite from './TeddySprite';

const TeddyCard = ({ bear, onSelect }) => {
  return (
    <Card className="bg-purple-700 text-white">
      <CardHeader>
        <h3 className="text-lg font-semibold">{bear.name}</h3>
        <p className="text-sm text-purple-300">{bear.title}</p>
      </CardHeader>
      <CardContent>
        <TeddySprite teddy={bear} />
        <p className="text-sm mb-2 mt-2">{bear.description}</p>
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