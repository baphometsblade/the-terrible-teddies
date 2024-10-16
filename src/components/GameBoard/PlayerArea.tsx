import React from 'react';
import TeddyCard from '../TeddyCard';
import { TeddyCard as TeddyCardType } from '../../types/types';
import { motion } from 'framer-motion';

interface PlayerAreaProps {
  hand: TeddyCardType[];
  field: TeddyCardType[];
  health: number;
  energy: number;
  deckSize: number;
  discardPileSize: number;
  onPlayCard: (card: TeddyCardType) => void;
  onUseSpecialAbility: (card: TeddyCardType) => void;
  onAttack: (card: TeddyCardType) => void;
}

const PlayerArea: React.FC<PlayerAreaProps> = ({
  hand,
  field,
  health,
  energy,
  deckSize,
  discardPileSize,
  onPlayCard,
  onUseSpecialAbility,
  onAttack,
}) => {
  return (
    <motion.div 
      className="player-area"
      initial={{ opacity: 0, y: 50 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <div className="player-stats flex justify-between items-center mb-4">
        <div className="health text-red-500 font-bold">Health: {health}</div>
        <div className="energy text-blue-500 font-bold">Energy: {energy}</div>
        <div className="deck-info flex space-x-4">
          <div className="deck text-gray-700">Deck: {deckSize}</div>
          <div className="discard-pile text-gray-700">Discard: {discardPileSize}</div>
        </div>
      </div>
      <div className="player-field flex justify-center space-x-2 mb-4">
        {field.map((card) => (
          <TeddyCard
            key={card.id}
            teddy={card}
            onClick={() => onAttack(card)}
            onSpecialAbility={() => onUseSpecialAbility(card)}
          />
        ))}
      </div>
      <div className="player-hand flex justify-center space-x-2">
        {hand.map((card) => (
          <TeddyCard
            key={card.id}
            teddy={card}
            onClick={() => onPlayCard(card)}
          />
        ))}
      </div>
    </motion.div>
  );
};

export default PlayerArea;