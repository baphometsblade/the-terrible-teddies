import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { PlayerArea } from './PlayerArea';
import { OpponentArea } from './OpponentArea';
import { GameInfo } from './GameInfo';
import { PlayerHand } from './PlayerHand';
import { BattleArena } from './BattleArena';
import { GameLog } from './GameLog';
import { applyCardEffect, checkGameOver } from '../../utils/gameLogic';
import { AIOpponent } from '../../utils/AIOpponent';
import { playSound } from '../../utils/audio';
import { terribleTeddies } from '../../data/terribleTeddies';

export const GameBoard = ({ onExit }) => {
  const [playerTeddies, setPlayerTeddies] = useState([]);
  const [opponentTeddies, setOpponentTeddies] = useState([]);
  const [playerHP, setPlayerHP] = useState(30);
  const [opponentHP, setOpponentHP] = useState(30);
  const [currentTurn, setCurrentTurn] = useState('player');
  const [momentumGauge, setMomentumGauge] = useState(0);
  const [activeEffects, setActiveEffects] = useState({ player: [], opponent: [] });
  const [gameLog, setGameLog] = useState([]);
  const [selectedTeddy, setSelectedTeddy] = useState(null);

  const ai = new AIOpponent('normal');

  useEffect(() => {
    const shuffledTeddies = [...terribleTeddies].sort(() => Math.random() - 0.5);
    setPlayerTeddies(shuffledTeddies.slice(0, 3));
    setOpponentTeddies(shuffledTeddies.slice(3, 6));
  }, []);

  const handlePlayTeddy = (teddy) => {
    if (currentTurn !== 'player') return;

    const newState = applyCardEffect({
      playerHP,
      opponentHP,
      momentumGauge,
      activeEffects,
      gameLog,
    }, teddy, false);

    updateGameState(newState);
    playSound('playCard');

    if (checkGameOver(newState)) {
      endGame(newState.playerHP > 0 ? 'player' : 'opponent');
    } else {
      setCurrentTurn('opponent');
      setTimeout(handleOpponentTurn, 1000);
    }
  };

  const handleOpponentTurn = () => {
    const aiTeddy = ai.chooseTeddy(opponentTeddies, { playerHP, opponentHP, momentumGauge, activeEffects });
    if (aiTeddy) {
      const newState = applyCardEffect({
        playerHP,
        opponentHP,
        momentumGauge,
        activeEffects,
        gameLog,
      }, aiTeddy, true);

      updateGameState(newState);
      setOpponentTeddies(opponentTeddies.filter(t => t.id !== aiTeddy.id));
      playSound('playCard');

      if (checkGameOver(newState)) {
        endGame(newState.playerHP > 0 ? 'player' : 'opponent');
      } else {
        setCurrentTurn('player');
      }
    } else {
      setCurrentTurn('player');
    }
  };

  const updateGameState = (newState) => {
    setPlayerHP(newState.playerHP);
    setOpponentHP(newState.opponentHP);
    setMomentumGauge(newState.momentumGauge);
    setActiveEffects(newState.activeEffects);
    setGameLog(newState.gameLog);
  };

  const endGame = (winner) => {
    playSound(winner === 'player' ? 'victory' : 'defeat');
    // Implement end game logic (e.g., show modal, update stats)
  };

  return (
    <div className="game-board p-4 bg-gradient-to-br from-purple-800 to-indigo-900 rounded-lg shadow-2xl">
      <OpponentArea teddies={opponentTeddies} hp={opponentHP} />
      <GameInfo currentTurn={currentTurn} momentumGauge={momentumGauge} />
      <BattleArena
        playerTeddies={playerTeddies}
        opponentTeddies={opponentTeddies}
        selectedTeddy={selectedTeddy}
        onTeddySelect={setSelectedTeddy}
        onPlayTeddy={handlePlayTeddy}
        currentTurn={currentTurn}
      />
      <PlayerArea teddies={playerTeddies} hp={playerHP} />
      <GameLog logs={gameLog} />
      <div className="mt-8 text-center">
        <Button onClick={onExit} className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded-lg shadow-lg transition duration-300 ease-in-out transform hover:scale-105">
          Exit Game
        </Button>
      </div>
    </div>
  );
};
