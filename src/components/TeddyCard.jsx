import React from 'react';
import { Card, CardContent } from "@/components/ui/card";

const TeddyCard = ({ teddy }) => {
  return (
    <Card className="w-20 h-28 bg-white rounded-lg shadow-lg overflow-hidden">
      <CardContent className="p-2 flex flex-col items-center justify-between h-full">
        <div className="text-xs font-bold truncate w-full text-center">{teddy.name}</div>
        <div className="w-12 h-12 bg-gray-200 rounded-full mb-1"></div>
        <div className="flex justify-between w-full text-xs">
          <span className="text-red-500">{teddy.attack}</span>
          <span className="text-blue-500">{teddy.defense}</span>
        </div>
      </CardContent>
    </Card>
  );
};

export default TeddyCard;