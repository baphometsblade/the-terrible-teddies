import React from 'react';
import { Card, CardContent, CardHeader, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import TeddySprite from './TeddySprite';

const TeddyCard = ({ teddy, onSelect, isPlayable = true }) => {
  return (
    <Card className="w-64 bg-purple-100 shadow-lg">
      <CardHeader>
        <h3 className="text-lg font-bold">{teddy.name}</h3>
        <p className="text-sm text-gray-600">{teddy.title}</p>
      </CardHeader>
      <CardContent>
        <TeddySprite teddy={teddy} />
        <p className="text-sm mb-2">{teddy.description}</p>
        <div className="grid grid-cols-2 gap-2">
          <p>Attack: {teddy.attack}</p>
          <p>Defense: {teddy.defense}</p>
        </div>
        <p className="mt-2">Special: {teddy.specialMove}</p>
      </CardContent>
      <CardFooter>
        {isPlayable && (
          <Button onClick={() => onSelect(teddy)} className="w-full">
            Select
          </Button>
        )}
      </CardFooter>
    </Card>
  );
};

export default TeddyCard;