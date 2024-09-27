import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import TeddyCard from './TeddyCard';
import { teddyData } from '../data/teddyData';

const GameBoard = () => {
  const [playerTeddies, setPlayerTeddies] = useState(teddyData.slice(0, 3));
  const [opponentTeddies, setOpponentTeddies] = useState(teddyData.slice(3, 6));
  const [selectedTeddy, setSelectedTeddy] = useState(null);

  const handleTeddySelect = (teddy) => {
    setSelectedTeddy(teddy);
  };

  const handleBattleInitiate = () => {
    if (selectedTeddy) {
      console.log(`Battle initiated with ${selectedTeddy.name}`);
      // Here we would implement the actual battle logic
    } else {
      console.log("Please select a teddy bear to battle");
    }
  };

  return (
    <div className="p-4 bg-gradient-to-r from-purple-400 to-pink-500">
      <h2 className="text-2xl font-bold text-white mb-4">Cheeky Teddy Brawl</h2>
      <div className="flex justify-between mb-4">
        <div>
          <h3 className="text-xl font-semibold text-white mb-2">Your Teddies</h3>
          <div className="flex space-x-4">
            {playerTeddies.map((teddy) => (
              <TeddyCard
                key={teddy.id}
                teddy={teddy}
                isSelected={selectedTeddy && selectedTeddy.id === teddy.id}
                onSelect={() => handleTeddySelect(teddy)}
              />
            ))}
          </div>
        </div>
        <div>
          <h3 className="text-xl font-semibold text-white mb-2">Opponent's Teddies</h3>
          <div className="flex space-x-4">
            {opponentTeddies.map((teddy) => (
              <TeddyCard key={teddy.id} teddy={teddy} />
            ))}
          </div>
        </div>
      </div>
      <Button
        onClick={handleBattleInitiate}
        disabled={!selectedTeddy}
        className="bg-yellow-400 hover:bg-yellow-500 text-black font-bold"
      >
        Initiate Battle
      </Button>
    </div>
  );
};

export default GameBoard;