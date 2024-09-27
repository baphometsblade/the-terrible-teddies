import React from 'react';
import { Card, CardContent, CardHeader, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const TeddyBear = ({ bear, onUseSpecialMove, onAttack, onDefend }) => {
  return (
    <Card className="w-64 bg-white shadow-lg rounded-lg overflow-hidden">
      <CardHeader>
        <h3 className="text-xl font-bold">{bear.name}</h3>
        <p className="text-sm text-gray-500">{bear.title}</p>
      </CardHeader>
      <CardContent>
        <img src={bear.imageUrl} alt={bear.name} className="w-full h-32 object-cover mb-2 rounded" />
        <p className="text-sm mb-2">{bear.description}</p>
        <p>Attack: {bear.attack}</p>
        <p>Defense: {bear.defense}</p>
        <p>Special Move: {bear.specialMove}</p>
      </CardContent>
      <CardFooter className="flex justify-between">
        <Button onClick={() => onAttack(bear)} className="bg-red-500 hover:bg-red-600">Attack</Button>
        <Button onClick={() => onDefend(bear)} className="bg-blue-500 hover:bg-blue-600">Defend</Button>
        <Button onClick={() => onUseSpecialMove(bear)} className="bg-purple-500 hover:bg-purple-600">Special</Button>
      </CardFooter>
    </Card>
  );
};

export default TeddyBear;