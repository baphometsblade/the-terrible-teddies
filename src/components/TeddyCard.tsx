import React from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TeddyCard as TeddyCardType } from '../types/types';

interface TeddyCardProps {
  teddy: TeddyCardType;
  onClick?: () => void;
  onSpecialAbility?: () => void;
}

const TeddyCard: React.FC<TeddyCardProps> = ({ teddy, onClick, onSpecialAbility }) => {
  return (
    <Card 
      className="w-24 h-36 bg-white rounded-lg shadow-lg overflow-hidden cursor-pointer"
      onClick={onClick}
    >
      <CardContent className="p-2 flex flex-col items-center justify-between h-full">
        <div className="text-xs font-bold truncate w-full text-center">{teddy.name}</div>
        <div className="w-12 h-12 bg-gray-200 rounded-full mb-1"></div>
        <div className="flex justify-between w-full text-xs">
          <span className="text-red-500">{teddy.attack}</span>
          <span className="text-blue-500">{teddy.defense}</span>
        </div>
        {onSpecialAbility && (
          <Button 
            className="mt-1 text-xs p-1" 
            onClick={(e) => {
              e.stopPropagation();
              onSpecialAbility();
            }}
          >
            {teddy.specialAbility.name}
          </Button>
        )}
      </CardContent>
    </Card>
  );
};

export default TeddyCard;