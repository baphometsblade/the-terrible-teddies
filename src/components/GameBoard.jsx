import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import TeddyCard from './TeddyCard';
import { teddyData } from '../data/teddyData';

const GameBoard = () => {
  const [playerBear, setPlayerBear] = useState(null);
  const [opponentBear, setOpponentBear] = useState(null);
  const [battleLog, setBattleLog] = useState([]);

  const selectBear = (bear) => {
    setPlayerBear(bear);
    const randomOpponent = teddyData[Math.floor(Math.random() * teddyData.length)];
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
    <div className="game-board">
      <h2 className="text-2xl font-bold mb-4">Battle Arena</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="player-area">
          <h3 className="text-xl font-semibold mb-2">Your Teddy</h3>
          {playerBear ? (
            <TeddyCard bear={playerBear} />
          ) : (
            <p>Select a teddy to battle</p>
          )}
        </div>
        <div className="opponent-area">
          <h3 className="text-xl font-semibold mb-2">Opponent's Teddy</h3>
          {opponentBear && <TeddyCard bear={opponentBear} />}
        </div>
      </div>
      <div className="mt-8">
        <h3 className="text-xl font-semibold mb-2">Your Collection</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {teddyData.map(bear => (
            <TeddyCard key={bear.id} bear={bear} onSelect={() => selectBear(bear)} />
          ))}
        </div>
      </div>
      <Button onClick={battle} className="mt-8" disabled={!playerBear || !opponentBear}>
        Battle!
      </Button>
      <div className="battle-log mt-8">
        <h3 className="text-xl font-semibold mb-2">Battle Log</h3>
        <ul className="bg-purple-800 p-4 rounded-lg">
          {battleLog.map((log, index) => (
            <li key={index} className="mb-2">{log}</li>
          ))}
        </ul>
      </div>
    </div>
  );
};

export default GameBoard;