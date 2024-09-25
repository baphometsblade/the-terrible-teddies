import React, { useState } from 'react';
import { Button, Typography } from '@mui/material';
import { TeddyBearCard } from './TeddyBearCard';
import { simulateBattle } from '../utils/gameLogic';

export function BattleArena({ playerBear, opponentBear }) {
  const [result, setResult] = useState(null);

  const handleBattle = async () => {
    const battleResult = await simulateBattle(playerBear.id, opponentBear.id);
    setResult(battleResult);
  };

  return (
    <div>
      <Typography variant="h4">Battle Arena</Typography>
      <div style={{ display: 'flex', justifyContent: 'space-around' }}>
        <TeddyBearCard bear={playerBear} />
        <TeddyBearCard bear={opponentBear} />
      </div>
      <Button onClick={handleBattle}>Start Battle</Button>
      {result && (
        <Typography>
          Winner: {result.winner.name}
        </Typography>
      )}
    </div>
  );
}