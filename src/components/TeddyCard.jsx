import React from 'react';
import { Card, CardContent, CardHeader, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const TeddyCard = ({ teddy, onPlay, isPlayable }) => {
  return (
    <Card className="w-48 bg-white shadow-lg rounded-lg overflow-hidden">
      <CardHeader>
        <h3 className="text-lg font-bold">{teddy.name}</h3>
        <p className="text-sm text-gray-500">{teddy.title}</p>
      </CardHeader>
      <CardContent>
        <img src={teddy.imageUrl} alt={teddy.name} className="w-full h-32 object-cover mb-2" />
        <p className="text-sm mb-1">Attack: {teddy.attack}</p>
        <p className="text-sm mb-1">Defense: {teddy.defense}</p>
        <p className="text-sm italic">{teddy.specialMove}</p>
      </CardContent>
      <CardFooter>
        <Button 
          onClick={() => onPlay(teddy)} 
          disabled={!isPlayable}
          className="w-full"
        >
          Play
        </Button>
      </CardFooter>
    </Card>
  );
};

export default TeddyCard;