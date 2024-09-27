import React from 'react';
import { Button } from "@/components/ui/button";
import { teddyData } from '../data/teddyData';

const TeddySelection = ({ onSelect }) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {teddyData.map((teddy) => (
        <div key={teddy.id} className="bg-white p-4 rounded-lg shadow-md">
          <img src={teddy.imageUrl} alt={teddy.name} className="w-full h-48 object-cover rounded-md mb-2" />
          <h3 className="text-xl font-semibold mb-1">{teddy.name}</h3>
          <p className="text-gray-600 mb-2">{teddy.title}</p>
          <p className="mb-1">Attack: {teddy.attack}</p>
          <p className="mb-2">Defense: {teddy.defense}</p>
          <Button onClick={() => onSelect(teddy)} className="w-full">
            Select {teddy.name}
          </Button>
        </div>
      ))}
    </div>
  );
};

export default TeddySelection;