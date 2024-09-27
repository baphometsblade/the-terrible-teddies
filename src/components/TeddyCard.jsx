import React from 'react';
import { Card, CardContent, CardHeader, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const TeddyCard = ({ teddy, onClick, selected, showDetails = false }) => {
  return (
    <Card 
      className={`w-full bg-white shadow-lg rounded-lg overflow-hidden ${selected ? 'ring-2 ring-purple-500' : ''}`}
      onClick={onClick}
    >
      <CardHeader>
        <h3 className="text-xl font-bold">{teddy.name}</h3>
        <p className="text-sm text-gray-600">{teddy.title}</p>
      </CardHeader>
      <CardContent>
        <img src={teddy.imageUrl || '/placeholder.svg'} alt={teddy.name} className="w-full h-32 object-cover mb-2 rounded" />
        {showDetails && <p className="text-sm mb-2">{teddy.description}</p>}
        <div className="grid grid-cols-2 gap-2">
          <p>Attack: {teddy.attack}</p>
          <p>Defense: {teddy.defense}</p>
        </div>
        {showDetails && <p className="mt-2">Special: {teddy.specialMove}</p>}
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