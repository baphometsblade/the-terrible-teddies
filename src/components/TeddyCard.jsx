import React from 'react';
import Image from 'next/image';

const TeddyCard = ({ teddy }) => {
  return (
    <div className="teddy-card">
      <h2>{teddy.name}</h2>
      <Image
        src={teddy.imageUrl}
        alt={teddy.name}
        width={200}
        height={200}
        loading="lazy"
        className="mx-auto object-cover"
      />
      <p>{teddy.description}</p>
      <div>Attack: {teddy.attack}</div>
      <div>Defense: {teddy.defense}</div>
      <div>Special Move: {teddy.specialMove}</div>
    </div>
  );
};

export default TeddyCard;