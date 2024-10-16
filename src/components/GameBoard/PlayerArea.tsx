import React from 'react';
import TeddyCard from '../TeddyCard';
import { TeddyCard as TeddyCardType } from '../../types/types';

interface PlayerAreaProps {
  hand: TeddyCardType[];
  field: TeddyCardType[];
  health: number;
  energy: number;
  onPlayCard: (card: TeddyCardType) => void;
  onUseSpecialAbility: (card: TeddyCardType) => void;
  onAttack: (card: TeddyCardType) => void;
}

const PlayerArea: React.FC<PlayerAreaProps> = ({
  hand,
  field,
  health,
  energy,
  onPlayCard,
  onUseSpecialAbility,
  onAttack,
}) => {
  return (
    <div className="player-area">
      <div className="player-stats">
        <div className="health">Health: {health}</div>
        <div className="energy">Energy: {energy}</div>
      </div>
      <div className="player-field">
        {field.map((card) => (
          <TeddyCard
            key={card.id}
            teddy={card}
            onClick={() => onAttack(card)}
            onSpecialAbility={() => onUseSpecialAbility(card)}
          />
        ))}
      </div>
      <div className="player-hand">
        {hand.map((card) => (
          <TeddyCard
            key={card.id}
            teddy={card}
            onClick={() => onPlayCard(card)}
          />
        ))}
      </div>
    </div>
  );
};

export default PlayerArea;