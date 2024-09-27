import React from 'react';
import { Card, CardContent, CardHeader, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const TeddyCard = ({ teddy }) => {
  return (
    <Card className="w-full bg-purple-100 shadow-lg">
      <CardHeader>
        <h3 className="text-lg font-bold">{teddy.name}</h3>
        <p className="text-sm text-gray-600">{teddy.title}</p>
      </CardHeader>
      <CardContent>
        <img src={teddy.imageUrl} alt={teddy.name} className="w-full h-48 object-cover rounded-md mb-2" />
        <p className="text-sm mb-2">{teddy.description}</p>
        <div className="grid grid-cols-2 gap-2">
          <p>Attack: {teddy.attack}</p>
          <p>Defense: {teddy.defense}</p>
        </div>
        <p className="mt-2">Special: {teddy.special_move}</p>
      </CardContent>
      <CardFooter>
        <Button className="w-full">
          Select
        </Button>
      </CardFooter>
    </Card>
  );
};

export default TeddyCard;