import React from 'react';
import { Card, CardContent } from "@/components/ui/card";

/**
 * Presentational component for a single teddy card. It now displays
 * the card's type and energy cost in addition to its name, attack and defense.
 */
const TeddyCard = ({ teddy, onClick }) => {
  return (
    <Card
      className="w-20 h-32 bg-white rounded-lg shadow-lg overflow-hidden cursor-pointer"
      onClick={onClick}
    >
      <CardContent className="p-2 flex flex-col items-center justify-between h-full">
        <div className="text-xs font-bold truncate w-full text-center">{teddy.name}</div>
        {teddy.type && (
          <div className="text-[10px] text-gray-500 uppercase">{teddy.type}</div>
        )}
        <div className="w-12 h-12 bg-gray-200 rounded-full mb-1"></div>
        <div className="flex justify-between w-full text-xs">
          <span className="text-red-500">{teddy.attack}</span>
          <span className="text-blue-500">{teddy.defense}</span>
          {teddy.cost !== undefined && (
            <span className="text-yellow-500">{teddy.cost}⚡</span>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default TeddyCard;
