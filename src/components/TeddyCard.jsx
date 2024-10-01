import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tooltip } from "@/components/ui/tooltip";

const TeddyCard = ({ teddy }) => {
  return (
    <Card className="w-64 h-96 flex flex-col">
      <CardHeader>
        <CardTitle className="text-lg">{teddy.name}</CardTitle>
        <p className="text-sm text-muted-foreground">{teddy.title}</p>
      </CardHeader>
      <CardContent className="flex-grow flex flex-col justify-between">
        <div>
          <img src={teddy.imageUrl} alt={teddy.name} className="w-full h-40 object-cover rounded-md mb-2" />
          <p className="text-sm mb-2">{teddy.description}</p>
        </div>
        <div className="flex justify-between items-center">
          <Tooltip content="Attack">
            <Badge variant="destructive">ATK: {teddy.attack}</Badge>
          </Tooltip>
          <Tooltip content="Defense">
            <Badge variant="secondary">DEF: {teddy.defense}</Badge>
          </Tooltip>
        </div>
        <Tooltip content={teddy.specialMoveDescription}>
          <Badge className="w-full text-center mt-2" variant="outline">
            {teddy.specialMove}
          </Badge>
        </Tooltip>
      </CardContent>
    </Card>
  );
};

export default TeddyCard;