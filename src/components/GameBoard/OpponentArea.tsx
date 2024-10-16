import React from 'react';
import TeddyCard from '../TeddyCard';
import { TeddyCard as TeddyCardType } from '../../types/types';
import { motion } from 'framer-motion';

interface OpponentAreaProps {
  field: TeddyCardType[];
  health: number;
  energy: number;
  handSize: number;
  deckSize: number;
  discardPileSize: number;
}

const OpponentArea: React.FC<OpponentAreaProps> = ({ 
  field, 
  health, 
  energy, 
  handSize, 
  deckSize, 
  discardPileSize 
}) => {
  return (
    <motion.div 
      className="opponent-area"
      initial={{ opacity: 0, y: -50 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <div className="opponent-stats flex justify-between items-center mb-4">
        <div className="health text-red-500 font-bold">Health: {health}</div>
        <div className="energy text-blue-500 font-bold">Energy: {energy}</div>
        <div className="deck-info flex space-x-4">
          <div className="hand-size text-gray-700">Hand: {handSize}</div>
          <div className="deck text-gray-700">Deck: {deckSize}</div>
          <div className="discard-pile text-gray-700">Discard: {discardPileSize}</div>
        </div>
      </div>
      <div className="opponent-field flex justify-center space-x-2">
        {field.map((card) => (
          <TeddyCard key={card.id} teddy={card} />
        ))}
      </div>
    </motion.div>
  );
};

export default OpponentArea;