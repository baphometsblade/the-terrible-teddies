import React from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const TeddyCard = ({ teddy, onSelect, isSelected }) => {
  return (
    <Card className={`w-64 ${isSelected ? 'border-4 border-blue-500' : ''}`}>
      <CardHeader>
        <CardTitle>{teddy.name}</CardTitle>
        <CardDescription>{teddy.title}</CardDescription>
      </CardHeader>
      <CardContent>
        <img src={teddy.imageUrl} alt={teddy.name} className="w-full h-32 object-cover mb-2 rounded" />
        <p className="text-sm mb-2">{teddy.description}</p>
        <p>Attack: {teddy.attack}</p>
        <p>Defense: {teddy.defense}</p>
        <p>Special Move: {teddy.specialMove}</p>
      </CardContent>
      {onSelect && (
        <CardFooter>
          <Button onClick={() => onSelect(teddy)} className="w-full">
            {isSelected ? 'Selected' : 'Select'}
          </Button>
        </CardFooter>
      )}
    </Card>
  );
};

export default TeddyCard;