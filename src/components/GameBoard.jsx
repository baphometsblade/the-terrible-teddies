import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import TeddyCard from './TeddyCard';
import { teddyData } from '../data/teddyData';
import AIOpponent from './AIOpponent';
import { calculateDamage } from '../utils/gameLogic';

const GameBoard = () => {
  const [playerTeddies, setPlayerTeddies] = useState(teddyData.slice(0, 3));
  const [opponentTeddies, setOpponentTeddies] = useState(teddyData.slice(3, 6));
  const [selectedTeddy, setSelectedTeddy] = useState(null);
  const [playerHP, setPlayerHP] = useState(30);
  const [opponentHP, setOpponentHP] = useState(30);
  const [currentTurn, setCurrentTurn] = useState('player');
  const [battleLog, setBattleLog] = useState([]);

  const handleTeddySelect = (teddy) => {
    setSelectedTeddy(teddy);
  };

  const handleAttack = (attacker, defender) => {
    const damage = calculateDamage(attacker, defender);
    if (currentTurn === 'player') {
      setOpponentHP(prevHP => Math.max(0, prevHP - damage));
      setBattleLog(prevLog => [...prevLog, `${attacker.name} attacks for ${damage} damage!`]);
      setCurrentTurn('opponent');
    } else {
      setPlayerHP(prevHP => Math.max(0, prevHP - damage));
      setBattleLog(prevLog => [...prevLog, `Enemy ${attacker.name} attacks for ${damage} damage!`]);
      setCurrentTurn('player');
    }
  };

  useEffect(() => {
    if (currentTurn === 'opponent') {
      const aiMove = AIOpponent.makeMove(opponentTeddies, playerTeddies);
      handleAttack(aiMove.attacker, aiMove.defender);
    }
  }, [currentTurn]);

  useEffect(() => {
    if (playerHP <= 0 || opponentHP <= 0) {
      setBattleLog(prevLog => [...prevLog, playerHP <= 0 ? "You lose!" : "You win!"]);
    }
  }, [playerHP, opponentHP]);

  return (
    <div className="p-4 bg-gradient-to-r from-purple-400 to-pink-500 rounded-lg shadow-lg">
      <h2 className="text-2xl font-bold text-white mb-4">Cheeky Teddy Brawl</h2>
      <div className="flex flex-col md:flex-row justify-between mb-4">
        <div className="mb-4 md:mb-0">
          <h3 className="text-xl font-semibold text-white mb-2">Your Teddies (HP: {playerHP})</h3>
          <div className="flex flex-wrap gap-4">
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
          <h3 className="text-xl font-semibold text-white mb-2">Opponent's Teddies (HP: {opponentHP})</h3>
          <div className="flex flex-wrap gap-4">
            {opponentTeddies.map((teddy) => (
              <TeddyCard key={teddy.id} teddy={teddy} />
            ))}
          </div>
        </div>
      </div>
      <Button
        onClick={() => selectedTeddy && handleAttack(selectedTeddy, opponentTeddies[0])}
        disabled={!selectedTeddy || currentTurn !== 'player' || playerHP <= 0 || opponentHP <= 0}
        className="bg-yellow-400 hover:bg-yellow-500 text-black font-bold"
      >
        Attack
      </Button>
      <div className="mt-4 bg-white p-4 rounded-lg max-h-40 overflow-y-auto">
        <h3 className="text-lg font-semibold mb-2">Battle Log</h3>
        <ul className="list-disc list-inside">
          {battleLog.map((log, index) => (
            <li key={index}>{log}</li>
          ))}
        </ul>
      </div>
    </div>
  );
};

export default GameBoard;