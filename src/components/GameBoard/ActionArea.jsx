import React from 'react';
import { Button } from "@/components/ui/button";
import PlayerHand from '../PlayerHand';

const ActionArea = ({ gameState, playerDeck, selectedTeddy, setSelectedTeddy, performAction, playerEnergy }) => {
  return (
    <div>
      {gameState === 'drawing' && (
        <div>
          <h2 className="text-2xl font-bold mb-2">Your Hand</h2>
          <PlayerHand
            hand={playerDeck}
            onSelectTeddy={setSelectedTeddy}
            selectedTeddy={selectedTeddy}
          />
          <Button onClick={() => performAction('startBattle')} className="mt-4" disabled={!selectedTeddy}>Start Battle</Button>
        </div>
      )}
      {gameState === 'battling' && (
        <div className="mt-4">
          <h2 className="text-2xl font-bold mb-2">Battle Actions</h2>
          <div className="flex space-x-2">
            <Button onClick={() => performAction('attack')}>Attack</Button>
            <Button onClick={() => performAction('defend')}>Defend</Button>
            <Button onClick={() => performAction('special')} disabled={playerEnergy < 2}>Special Move (2 Energy)</Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ActionArea;