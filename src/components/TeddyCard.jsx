import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const TeddyCard = ({ teddy }) => {
  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>{teddy.name}</CardTitle>
      </CardHeader>
      <CardContent>
        <p><strong>Title:</strong> {teddy.title}</p>
        <p><strong>Description:</strong> {teddy.description}</p>
        <p><strong>Attack:</strong> {teddy.attack}</p>
        <p><strong>Defense:</strong> {teddy.defense}</p>
        <p><strong>Special Move:</strong> {teddy.special_move}</p>
      </CardContent>
    </Card>
  );
};

export default TeddyCard;