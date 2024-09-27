import React from 'react';
import { Button } from "@/components/ui/button";

const PlayerHand = ({ hand, onCardPlay, momentumGauge }) => {
  return (
    <div className="player-hand">
      <h3>Your Hand</h3>
      <div className="cards">
        {hand.map((card) => (
          <div key={card.id} className="card">
            <h4>{card.name}</h4>
            <p>Attack: {card.attack}</p>
            <p>Defense: {card.defense}</p>
            <p>Energy Cost: {card.energy_cost}</p>
            <Button 
              onClick={() => onCardPlay(card)}
              disabled={card.energy_cost > 10 - momentumGauge}
            >
              Play
            </Button>
          </div>
        ))}
      </div>
      <div>Momentum Gauge: {momentumGauge}/10</div>
    </div>
  );
};

export default PlayerHand;