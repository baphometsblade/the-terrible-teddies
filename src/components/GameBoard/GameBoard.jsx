import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { TeddyCard } from '../TeddyCard';
import { ActiveEffects } from './ActiveEffects';
import { applyCardEffect, checkGameOver } from '../../utils/gameLogic';

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

  if (isLoading) return <div>Loading game...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return (
    <div className="game-board p-4 bg-gray-100 rounded-lg shadow-lg">
      <div className="opponent-area mb-8">
        <h2 className="text-2xl font-bold mb-4">Opponent (HP: {opponentHP})</h2>
        <div className="flex space-x-2 justify-center">
          {opponentHand.map((card) => (
            <div key={card.id} className="w-24 h-32 bg-gray-300 rounded"></div>
          ))}
        </div>
      </div>
      <ActiveEffects effects={activeEffects.opponent} />
      <div className="battle-area mb-8 bg-gray-200 p-4 rounded-lg">
        <p className="text-2xl text-center">{currentTurn === 'player' ? "Your Turn" : "Opponent's Turn"}</p>
        <p className="text-center">Momentum Gauge: {momentumGauge}/10</p>
      </div>
      <ActiveEffects effects={activeEffects.player} />
      <div className="player-area">
        <h2 className="text-2xl font-bold mb-4">Your Hand (HP: {playerHP})</h2>
        <div className="flex flex-wrap justify-center gap-2">
          {playerHand.map((card) => (
            <TeddyCard key={card.id} teddy={card} onClick={() => handlePlayCard(card)} />
          ))}
        </div>
      </div>
      <Button onClick={onExit} className="mt-8">Exit Game</Button>
    </div>
  );
};
