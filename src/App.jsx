import React, { useState } from 'react';
import { BattleArena } from './components/BattleArena';
import { TeddyBear } from './components/TeddyBear';
import { generateTeddyBear } from './utils/teddyGenerator';

const App = () => {
  const [playerBear, setPlayerBear] = useState(generateTeddyBear());
  const [opponentBear, setOpponentBear] = useState(generateTeddyBear());
  const [gameState, setGameState] = useState('selection'); // 'selection', 'battle', 'result'

  const startBattle = () => {
    setGameState('battle');
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-4xl font-bold mb-8 text-center text-purple-600">Terrible Teddies</h1>
      {gameState === 'selection' && (
        <div>
          <h2 className="text-2xl font-bold mb-4">Select Your Teddy</h2>
          <TeddyBear bear={playerBear} />
          <button
            onClick={startBattle}
            className="mt-4 bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
          >
            Start Battle
          </button>
        </div>
      )}
      {gameState === 'battle' && (
        <BattleArena playerBear={playerBear} opponentBear={opponentBear} />
      )}
    </div>
  );
};

export default App;