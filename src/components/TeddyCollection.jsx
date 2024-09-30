import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const TeddyCollection = () => {
  // This is a placeholder for actual teddy data
  const teddies = [
    { id: 1, name: "Whiskey Whiskers", attack: 7, defense: 5 },
    { id: 2, name: "Madame Mistletoe", attack: 6, defense: 6 },
    { id: 3, name: "Baron Von Blubber", attack: 8, defense: 4 },
  ];

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-6">My Teddy Collection</h1>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {teddies.map(teddy => (
          <Card key={teddy.id}>
            <CardHeader>
              <CardTitle>{teddy.name}</CardTitle>
            </CardHeader>
            <CardContent>
              <p>Attack: {teddy.attack}</p>
              <p>Defense: {teddy.defense}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default TeddyCollection;