import React, { useState } from 'react';
import { TeddyBear } from './TeddyBear';
import { calculateDamage } from '../utils/battleLogic';

export const BattleArena = ({ playerBear, opponentBear }) => {
  const [playerHealth, setPlayerHealth] = useState(30);
  const [opponentHealth, setOpponentHealth] = useState(30);
  const [playerEnergy, setPlayerEnergy] = useState(3);
  const [opponentEnergy, setOpponentEnergy] = useState(3);
  const [battleLog, setBattleLog] = useState([]);

  const attack = () => {
    const damage = calculateDamage(playerBear, opponentBear);
    setOpponentHealth(prev => Math.max(0, prev - damage));
    setBattleLog(prev => [...prev, `${playerBear.name} attacks for ${damage} damage!`]);
    endTurn();
  };

  const defend = () => {
    setPlayerBear(prev => ({ ...prev, defense: prev.defense + 2 }));
    setBattleLog(prev => [...prev, `${playerBear.name} increases defense by 2!`]);
    endTurn();
  };

  const useSpecialMove = () => {
    if (playerEnergy >= 2) {
      setPlayerEnergy(prev => prev - 2);
      // Implement special move logic here
      setBattleLog(prev => [...prev, `${playerBear.name} uses ${playerBear.specialMove}!`]);
      endTurn();
    }
  };

  const endTurn = () => {
    // Implement opponent's turn logic here
    // For now, just a simple attack
    const opponentDamage = calculateDamage(opponentBear, playerBear);
    setPlayerHealth(prev => Math.max(0, prev - opponentDamage));
    setBattleLog(prev => [...prev, `${opponentBear.name} attacks for ${opponentDamage} damage!`]);
  };

  return (
    <div>
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <h2 className="text-2xl font-bold mb-2">Your Teddy</h2>
          <TeddyBear bear={playerBear} />
          <p>Health: {playerHealth}/30</p>
          <p>Energy: {playerEnergy}/3</p>
        </div>
        <div>
          <h2 className="text-2xl font-bold mb-2">Opponent's Teddy</h2>
          <TeddyBear bear={opponentBear} />
          <p>Health: {opponentHealth}/30</p>
          <p>Energy: {opponentEnergy}/3</p>
        </div>
      </div>
      <div className="mb-4">
        <button onClick={attack} className="bg-red-500 hover:bg-red-700 text-white font-bold py-2 px-4 rounded mr-2">
          Attack
        </button>
        <button onClick={defend} className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded mr-2">
          Defend
        </button>
        <button onClick={useSpecialMove} disabled={playerEnergy < 2} className="bg-purple-500 hover:bg-purple-700 text-white font-bold py-2 px-4 rounded">
          Use Special Move
        </button>
      </div>
      <div>
        <h3 className="text-xl font-bold mb-2">Battle Log</h3>
        <ul className="list-disc list-inside">
          {battleLog.map((log, index) => (
            <li key={index}>{log}</li>
          ))}
        </ul>
      </div>
    </div>
  );
};