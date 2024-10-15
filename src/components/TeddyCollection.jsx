import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const TeddyCollection = ({ playerTeddies, selectedTeddy, setSelectedTeddy }) => {
  const renderTeddyCard = (teddy) => (
    <Card key={teddy.id} className={`cursor-pointer ${selectedTeddy?.id === teddy.id ? 'border-4 border-blue-500' : ''}`}
         onClick={() => setSelectedTeddy(teddy)}>
      <CardHeader>
        <CardTitle>{teddy.name}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-gray-600">{teddy.title}</p>
        <p className="mt-2">{teddy.description}</p>
        <div className="mt-2 flex justify-between">
          <span>Attack: {teddy.attack}</span>
          <span>Defense: {teddy.defense}</span>
        </div>
        <p className="mt-2 text-sm font-semibold">Special: {teddy.special_move}</p>
        <p className="mt-2 text-sm">Level: {teddy.level} | XP: {teddy.experience}/{teddy.level * 100}</p>
      </CardContent>
    </Card>
  );

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {playerTeddies && playerTeddies.map(renderTeddyCard)}
    </div>
  );
};

export default TeddyCollection;