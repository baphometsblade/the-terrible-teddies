import React from 'react';

export const TeddyBear = ({ bear }) => {
  return (
    <div className="bg-white shadow-lg rounded-lg p-6 mb-4">
      <h3 className="text-xl font-bold mb-2">{bear.name}</h3>
      <p className="text-gray-600 mb-2">{bear.title}</p>
      <p className="mb-2">{bear.description}</p>
      <div className="grid grid-cols-2 gap-2">
        <p>Attack: {bear.attack}</p>
        <p>Defense: {bear.defense}</p>
      </div>
      <p className="mt-2">Special Move: {bear.specialMove}</p>
    </div>
  );
};