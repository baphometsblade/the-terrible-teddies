import React from 'react';

export const Card = ({ card, onClick, onPlay }) => {
  return (
    <div className="card" onClick={onClick}>
      <h3>{card.name}</h3>
      <p>Attack: {card.attack}</p>
      <p>Defense: {card.defense}</p>
      <p>Special Move: {card.special_move}</p>
      <button onClick={(e) => {
        e.stopPropagation();
        onPlay();
      }}>Play Card</button>
    </div>
  );
};
