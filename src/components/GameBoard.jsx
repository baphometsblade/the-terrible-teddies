import React, { useState } from 'react';
import { teddyBears } from '../data/teddyBears';
import { Button } from "@/components/ui/button";

const GameBoard = () => {
  const [playerBear, setPlayerBear] = useState(null);
  const [opponentBear, setOpponentBear] = useState(null);
  const [battleLog, setBattleLog] = useState([]);

  const selectBear = (bear) => {
    setPlayerBear(bear);
    const randomOpponent = teddyBears[Math.floor(Math.random() * teddyBears.length)];
    setOpponentBear(randomOpponent);
    setBattleLog([]);
  };

  const battle = () => {
    if (!playerBear || !opponentBear) return;

    const playerDamage = Math.max(0, playerBear.attack - opponentBear.defense);
    const opponentDamage = Math.max(0, opponentBear.attack - playerBear.defense);

    setBattleLog(prevLog => [
      ...prevLog,
      `${playerBear.name} deals ${playerDamage} damage to ${opponentBear.name}`,
      `${opponentBear.name} deals ${opponentDamage} damage to ${playerBear.name}`
    ]);
  };

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">Terrible Teddies Battle Arena</h1>
      <div className="grid grid-cols-3 gap-4 mb-4">
        {teddyBears.map(bear => (
          <div key={bear.id} className="border p-2 rounded">
            <h2 className="font-bold">{bear.name}</h2>
            <p>{bear.title}</p>
            <p>Attack: {bear.attack} | Defense: {bear.defense}</p>
            <Button onClick={() => selectBear(bear)}>Select</Button>
          </div>
        ))}
      </div>
      {playerBear && opponentBear && (
        <div className="mb-4">
          <h2 className="text-xl font-bold">Battle</h2>
          <p>Your Bear: {playerBear.name}</p>
          <p>Opponent Bear: {opponentBear.name}</p>
          <Button onClick={battle}>Fight!</Button>
        </div>
      )}
      <div>
        <h2 className="text-xl font-bold">Battle Log</h2>
        {battleLog.map((log, index) => (
          <p key={index}>{log}</p>
        ))}
      </div>
    </div>
  );
};

export default GameBoard;