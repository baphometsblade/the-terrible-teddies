import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { TeddyBearCard } from './TeddyBearCard';
import { simulateBattle } from '../utils/gameLogic';

export function BattleArena({ playerBear, opponentBear }) {
  const [result, setResult] = useState(null);

  const handleBattle = async () => {
    const battleResult = await simulateBattle(playerBear.id, opponentBear.id);
    setResult(battleResult);
  };

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold">Battle Arena</h2>
      <div className="flex justify-around">
        <TeddyBearCard bear={playerBear} />
        <TeddyBearCard bear={opponentBear} />
      </div>
      <Button onClick={handleBattle}>Start Battle</Button>
      {result && (
        <p className="text-lg font-semibold">
          Winner: {result.winner.name}
        </p>
      )}
    </div>
  );
}
