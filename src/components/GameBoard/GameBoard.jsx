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

const fetchUserDeck = async () => {
  const { data, error } = await supabase.from('user_decks').select('*').single();
  if (error) throw error;
  return data.deck;
};

export const GameBoard = ({ onExit }) => {
  const [playerHand, setPlayerHand] = useState([]);
  const [opponentHand, setOpponentHand] = useState([]);
  const [playerHP, setPlayerHP] = useState(30);
  const [opponentHP, setOpponentHP] = useState(30);
  const [currentTurn, setCurrentTurn] = useState('player');
  const [momentumGauge, setMomentumGauge] = useState(0);
  const [activeEffects, setActiveEffects] = useState({ player: [], opponent: [] });
  const [gameLog, setGameLog] = useState([]);
  const [selectedCard, setSelectedCard] = useState(null);

  const { data: userDeck, isLoading, error } = useQuery({
    queryKey: ['userDeck'],
    queryFn: fetchUserDeck,
  });

  const ai = new AIOpponent('normal');

  useEffect(() => {
    if (userDeck) {
      const shuffledDeck = [...userDeck].sort(() => Math.random() - 0.5);
      setPlayerHand(shuffledDeck.slice(0, 5));
      setOpponentHand(shuffledDeck.slice(5, 10));
    }
  }, [userDeck]);

  const handlePlayCard = (card) => {
    if (currentTurn !== 'player' || card.energy_cost > 10 - momentumGauge) return;

    const newState = applyCardEffect({
      playerHP,
      opponentHP,
      momentumGauge,
      activeEffects,
      gameLog,
    }, card, false);

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
    const aiCard = ai.chooseCard(opponentHand, { playerHP, opponentHP, momentumGauge, activeEffects });
    if (aiCard) {
      const newState = applyCardEffect({
        playerHP,
        opponentHP,
        momentumGauge,
        activeEffects,
        gameLog,
      }, aiCard, true);

      updateGameState(newState);
      setOpponentHand(opponentHand.filter(c => c.id !== aiCard.id));
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

  if (isLoading) return <div className="text-center text-2xl">Loading game...</div>;
  if (error) return <div className="text-center text-2xl text-red-500">Error: {error.message}</div>;

  return (
    <div className="game-board p-4 bg-gradient-to-br from-purple-800 to-indigo-900 rounded-lg shadow-2xl">
      <OpponentArea teddies={opponentHand} hp={opponentHP} />
      <GameInfo currentTurn={currentTurn} momentumGauge={momentumGauge} />
      <BattleArena
        playerTeddies={playerHand.filter(card => card.type === 'Teddy')}
        opponentTeddies={opponentHand.filter(card => card.type === 'Teddy')}
        selectedCard={selectedCard}
        onCardSelect={setSelectedCard}
      />
      <PlayerArea teddies={playerHand.filter(card => card.type === 'Teddy')} hp={playerHP} />
      <PlayerHand cards={playerHand} onPlayCard={handlePlayCard} onSelectCard={setSelectedCard} />
      <GameLog logs={gameLog} />
      <div className="mt-8 text-center">
        <Button onClick={onExit} className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded-lg shadow-lg transition duration-300 ease-in-out transform hover:scale-105">
          Exit Game
        </Button>
      </div>
    </div>
  );
};
