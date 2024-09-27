import React, { useState } from 'react';
import TeddyBear from './TeddyBear';
import { Button } from "@/components/ui/button";

const BattleArena = ({ playerBear, opponentBear, onEndTurn }) => {
  const [playerHealth, setPlayerHealth] = useState(30);
  const [opponentHealth, setOpponentHealth] = useState(30);
  const [playerEnergy, setPlayerEnergy] = useState(3);
  const [battleLog, setBattleLog] = useState([]);

  const addToBattleLog = (message) => {
    setBattleLog((prevLog) => [...prevLog, message]);
  };

  const handleAttack = (bear) => {
    const damage = Math.max(0, bear.attack - opponentBear.defense);
    setOpponentHealth((prevHealth) => Math.max(0, prevHealth - damage));
    addToBattleLog(`${bear.name} attacks for ${damage} damage!`);
    onEndTurn();
  };

  const handleDefend = (bear) => {
    setPlayerHealth((prevHealth) => Math.min(30, prevHealth + bear.defense));
    addToBattleLog(`${bear.name} defends and recovers ${bear.defense} health!`);
    onEndTurn();
  };

  const handleUseSpecialMove = (bear) => {
    if (playerEnergy >= 1) {
      setPlayerEnergy((prevEnergy) => prevEnergy - 1);
      addToBattleLog(`${bear.name} uses ${bear.specialMove}!`);
      // Implement special move logic here
      onEndTurn();
    } else {
      addToBattleLog("Not enough energy to use special move!");
    }
  };

  return (
    <div className="battle-arena p-4 bg-gray-100 rounded-lg">
      <div className="flex justify-between mb-4">
        <div>
          <h2 className="text-xl font-bold">Your Bear</h2>
          <p>Health: {playerHealth}/30</p>
          <p>Energy: {playerEnergy}/3</p>
        </div>
        <div>
          <h2 className="text-xl font-bold">Opponent's Bear</h2>
          <p>Health: {opponentHealth}/30</p>
        </div>
      </div>
      <div className="flex justify-between mb-4">
        <TeddyBear
          bear={playerBear}
          onAttack={handleAttack}
          onDefend={handleDefend}
          onUseSpecialMove={handleUseSpecialMove}
        />
        <TeddyBear bear={opponentBear} />
      </div>
      <div className="battle-log bg-white p-4 rounded-lg h-40 overflow-y-auto">
        <h3 className="text-lg font-bold mb-2">Battle Log</h3>
        {battleLog.map((log, index) => (
          <p key={index}>{log}</p>
        ))}
      </div>
    </div>
  );
};

export default BattleArena;