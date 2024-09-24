import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { TeddyCard } from '../TeddyCard';
import { ActiveEffects } from './ActiveEffects';
import { PlayerArea } from './PlayerArea';
import { OpponentArea } from './OpponentArea';
import { GameInfo } from './GameInfo';
import { PlayerHand } from './PlayerHand';
import { applyCardEffect, checkGameOver } from '../../utils/gameLogic';
import { motion } from 'framer-motion';

const fetchCards = async () => {
  const { data, error } = await supabase.from('generated_images').select('*');
  if (error) throw error;
  return data;
};

export const GameBoard = ({ onExit }) => {
  const [playerHand, setPlayerHand] = useState([]);
  const [opponentHand, setOpponentHand] = useState([]);
  const [playerHP, setPlayerHP] = useState(30);
  const [opponentHP, setOpponentHP] = useState(30);
  const [currentTurn, setCurrentTurn] = useState('player');
  const [momentumGauge, setMomentumGauge] = useState(0);
  const [activeEffects, setActiveEffects] = useState({ player: [], opponent: [] });

  const { data: cards, isLoading, error } = useQuery({
    queryKey: ['cards'],
    queryFn: fetchCards,
  });

  useEffect(() => {
    if (cards) {
      const shuffledCards = [...cards].sort(() => Math.random() - 0.5);
      setPlayerHand(shuffledCards.slice(0, 5));
      setOpponentHand(shuffledCards.slice(5, 10));
    }
  }, [cards]);

  const handlePlayCard = (card) => {
    if (currentTurn !== 'player' || card.energy_cost > 10 - momentumGauge) return;

    const newState = applyCardEffect({
      playerHP,
      opponentHP,
      momentumGauge,
      activeEffects,
    }, card, false);

    setPlayerHP(newState.playerHP);
    setOpponentHP(newState.opponentHP);
    setMomentumGauge(newState.momentumGauge);
    setActiveEffects(newState.activeEffects);
    setPlayerHand(playerHand.filter(c => c.id !== card.id));

    const { isGameOver, winner } = checkGameOver(newState);
    if (isGameOver) {
      alert(`Game Over! ${winner === 'player' ? 'You win!' : 'You lose!'}`);
      onExit();
    } else {
      setCurrentTurn('opponent');
      setTimeout(handleOpponentTurn, 1000);
    }
  };

  const handleOpponentTurn = () => {
    // Simple AI: play a random card
    const playableCards = opponentHand.filter(card => card.energy_cost <= 10 - momentumGauge);
    if (playableCards.length > 0) {
      const randomCard = playableCards[Math.floor(Math.random() * playableCards.length)];
      const newState = applyCardEffect({
        playerHP,
        opponentHP,
        momentumGauge,
        activeEffects,
      }, randomCard, true);

      setPlayerHP(newState.playerHP);
      setOpponentHP(newState.opponentHP);
      setMomentumGauge(newState.momentumGauge);
      setActiveEffects(newState.activeEffects);
      setOpponentHand(opponentHand.filter(c => c.id !== randomCard.id));

      const { isGameOver, winner } = checkGameOver(newState);
      if (isGameOver) {
        alert(`Game Over! ${winner === 'player' ? 'You win!' : 'You lose!'}`);
        onExit();
      } else {
        setCurrentTurn('player');
      }
    } else {
      setCurrentTurn('player');
    }
  };

  if (isLoading) return <div className="text-center text-2xl">Loading game...</div>;
  if (error) return <div className="text-center text-2xl text-red-500">Error: {error.message}</div>;

  return (
    <motion.div 
      className="game-board p-4 bg-gradient-to-br from-purple-800 to-indigo-900 rounded-lg shadow-2xl"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
    >
      <OpponentArea teddies={opponentHand} hp={opponentHP} />
      <ActiveEffects effects={activeEffects.opponent} />
      <GameInfo currentTurn={currentTurn} momentumGauge={momentumGauge} />
      <ActiveEffects effects={activeEffects.player} />
      <PlayerArea teddies={playerHand} hp={playerHP} />
      <PlayerHand cards={playerHand} onPlayCard={handlePlayCard} />
      <div className="mt-8 text-center">
        <Button onClick={onExit} className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded-lg shadow-lg transition duration-300 ease-in-out transform hover:scale-105">
          Exit Game
        </Button>
      </div>
    </motion.div>
  );
};
