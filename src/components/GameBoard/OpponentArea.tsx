import React from 'react';
import TeddyCard from '../TeddyCard';
import { TeddyCard as TeddyCardType } from '../../types/types';

interface OpponentAreaProps {
  field: TeddyCardType[];
  health: number;
  energy: number;
}

const OpponentArea: React.FC<OpponentAreaProps> = ({ field, health, energy }) => {
  return (
    <div className="opponent-area">
      <div className="opponent-stats">
        <div className="health">Health: {health}</div>
        <div className="energy">Energy: {energy}</div>
      </div>
      <div className="opponent-field">
        {field.map((card) => (
          <TeddyCard key={card.id} teddy={card} />
        ))}
      </div>
    </div>
  );
};

export default OpponentArea;