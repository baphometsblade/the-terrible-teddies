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

const fetchCards = async () => {
  const { data, error } = await supabase.from('generated_images').select('*');
  if (error) throw error;
  return data;
};

export const GameBoard = ({ onExit }) => {
  const { data: cards, isLoading, error } = useQuery({
    queryKey: ['cards'],
    queryFn: fetchCards,
  });

  const [playerDeck, setPlayerDeck] = useState([]);
  const [opponentDeck, setOpponentDeck] = useState([]);
  const [playerHand, setPlayerHand] = useState([]);
  const [playerHP, setPlayerHP] = useState(30);
  const [opponentHP, setOpponentHP] = useState(30);
  const [currentTurn, setCurrentTurn] = useState('player');
  const [momentumGauge, setMomentumGauge] = useState(0);
  const [activeEffects, setActiveEffects] = useState({ player: [], opponent: [] });
  const [gameLog, setGameLog] = useState([]);

  const ai = new AIOpponent('normal');

  useEffect(() => {
    if (cards) {
      const shuffledCards = [...cards].sort(() => Math.random() - 0.5);
      setPlayerDeck(shuffledCards.slice(0, 20));
      setOpponentDeck(shuffledCards.slice(20, 40));
      drawInitialHand();
    }
  }, [cards]);

  const drawInitialHand = () => {
    setPlayerHand(playerDeck.slice(0, 5));
    setPlayerDeck(playerDeck.slice(5));
  };

  const drawCard = () => {
    if (playerDeck.length > 0) {
      const newCard = playerDeck[0];
      setPlayerHand([...playerHand, newCard]);
      setPlayerDeck(playerDeck.slice(1));
      playSound('drawCard');
    }
  };

  const handlePlayCard = (card) => {
    if (currentTurn !== 'player') return;

    const newState = applyCardEffect({
      playerHP,
      opponentHP,
      momentumGauge,
      activeEffects,
      gameLog,
    }, card, false);

    updateGameState(newState);
    setPlayerHand(playerHand.filter(c => c.id !== card.id));
    playSound('playCard');

    if (checkGameOver(newState)) {
      endGame(newState.playerHP > 0 ? 'player' : 'opponent');
    } else {
      setCurrentTurn('opponent');
      setTimeout(handleOpponentTurn, 1000);
    }
  };

  const handleOpponentTurn = () => {
    const aiCard = ai.chooseCard(opponentDeck, { playerHP, opponentHP, momentumGauge, activeEffects });
    if (aiCard) {
      const newState = applyCardEffect({
        playerHP,
        opponentHP,
        momentumGauge,
        activeEffects,
        gameLog,
      }, aiCard, true);

      updateGameState(newState);
      setOpponentDeck(opponentDeck.filter(c => c.id !== aiCard.id));
      playSound('playCard');

      if (checkGameOver(newState)) {
        endGame(newState.playerHP > 0 ? 'player' : 'opponent');
      } else {
        setCurrentTurn('player');
        drawCard();
      }
    } else {
      setCurrentTurn('player');
      drawCard();
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

  if (isLoading) return <div>Loading game assets...</div>;
  if (error) return <div>Error loading game assets: {error.message}</div>;

  return (
    <div className="game-board p-4 bg-gradient-to-br from-purple-800 to-indigo-900 rounded-lg shadow-2xl">
      <OpponentArea deck={opponentDeck} hp={opponentHP} />
      <GameInfo currentTurn={currentTurn} momentumGauge={momentumGauge} />
      <BattleArena
        playerCards={playerHand}
        opponentCards={opponentDeck.slice(0, 5)}
        onPlayCard={handlePlayCard}
        currentTurn={currentTurn}
      />
      <PlayerArea deck={playerDeck} hand={playerHand} hp={playerHP} />
      <GameLog logs={gameLog} />
      <div className="mt-8 text-center">
        <Button onClick={onExit} className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded-lg shadow-lg transition duration-300 ease-in-out transform hover:scale-105">
          Exit Game
        </Button>
      </div>
    </div>
  );
};
