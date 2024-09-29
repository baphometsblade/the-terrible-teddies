import React from 'react';

const TeddyCard = ({ teddy }) => {
  return (
    <div className="teddy-card border p-4 rounded-lg">
      <h3 className="text-lg font-bold">{teddy.name}</h3>
      <p className="text-sm italic">{teddy.title}</p>
      <p className="mt-2">{teddy.description}</p>
      <div className="mt-2">
        <p>Attack: {teddy.attack}</p>
        <p>Defense: {teddy.defense}</p>
        <p>Special Move: {teddy.special_move}</p>
      </div>
    </div>
  );
};

export default TeddyCard;