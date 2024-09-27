import React from 'react';
import { Card, CardContent, CardHeader, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const TeddyCard = ({ teddy, onClick, selected, faceDown }) => {
  if (faceDown) {
    return (
      <Card className="w-full bg-purple-300 h-40 flex items-center justify-center">
        <p className="text-2xl font-bold text-purple-700">?</p>
      </Card>
    );
  }

  return (
    <Card 
      className={`w-full bg-white shadow-lg rounded-lg overflow-hidden ${selected ? 'ring-2 ring-purple-500' : ''}`}
      onClick={onClick}
    >
      <CardHeader>
        <h3 className="text-xl font-bold">{teddy.name}</h3>
      </CardHeader>
      <CardContent>
        <p className="text-sm mb-2">{teddy.title}</p>
        <p>Attack: {teddy.attack}</p>
        <p>Defense: {teddy.defense}</p>
      </CardContent>
      {onClick && (
        <CardFooter>
          <Button onClick={onClick} className="w-full">Select</Button>
        </CardFooter>
      )}
    </Card>
  );
};

export default TeddyCard;