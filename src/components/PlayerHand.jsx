import React from 'react';
import { Card } from './Card';

export const PlayerHand = ({ hand, onCardSelect, onCardPlay }) => {
  return (
    <div className="player-hand">
      {hand.map((card) => (
        <Card 
          key={card.id} 
          card={card} 
          onClick={() => onCardSelect(card)}
          onPlay={() => onCardPlay(card)}
        />
      ))}
    </div>
  );
};