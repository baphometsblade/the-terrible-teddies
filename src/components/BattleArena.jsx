import React, { useState } from 'react';
import TeddyCard from './TeddyCard';
import { Button } from "@/components/ui/button";

const BattleArena = ({ selectedCard, opponentDeck }) => {
  const [opponentCard, setOpponentCard] = useState(null);
  const [battleResult, setBattleResult] = useState(null);

  const startBattle = () => {
    if (!selectedCard) return;
    const randomOpponentCard = opponentDeck[Math.floor(Math.random() * opponentDeck.length)];
    setOpponentCard(randomOpponentCard);

    // Simple battle logic
    if (selectedCard.attack > randomOpponentCard.defense) {
      setBattleResult('You win!');
    } else if (selectedCard.attack < randomOpponentCard.defense) {
      setBattleResult('You lose!');
    } else {
      setBattleResult("It's a draw!");
    }
  };

  return (
    <div className="mt-8">
      <h2 className="text-2xl font-bold mb-4">Battle Arena</h2>
      <div className="flex justify-between">
        <div>
          <h3 className="text-xl mb-2">Your Teddy</h3>
          {selectedCard && <TeddyCard teddy={selectedCard} />}
        </div>
        <div>
          <h3 className="text-xl mb-2">Opponent's Teddy</h3>
          {opponentCard && <TeddyCard teddy={opponentCard} />}
        </div>
      </div>
      <div className="mt-4 text-center">
        <Button onClick={startBattle} disabled={!selectedCard}>Start Battle</Button>
        {battleResult && <p className="mt-2 text-xl font-bold">{battleResult}</p>}
      </div>
    </div>
  );
};

export default BattleArena;