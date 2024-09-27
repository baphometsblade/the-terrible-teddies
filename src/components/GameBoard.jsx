import React, { useState, useEffect } from 'react';
import { PlayerArea } from './GameBoard/PlayerArea';
import { OpponentArea } from './GameBoard/OpponentArea';
import { GameInfo } from './GameBoard/GameInfo';
import { CardDetail } from './GameBoard/CardDetail';
import { ActiveEffects } from './GameBoard/ActiveEffects';
import { Button } from "@/components/ui/button";
import { initializeGame, playCard, endTurn, checkGameOver } from '../utils/gameLogic';
import { motion, AnimatePresence } from 'framer-motion';

const GameBoard = ({ onExitGame }) => {
  const [gameState, setGameState] = useState(null);
  const [selectedCard, setSelectedCard] = useState(null);
  const [showCardDetail, setShowCardDetail] = useState(false);
  const [activeEffects, setActiveEffects] = useState([]);

  useEffect(() => {
    setGameState(initializeGame());
  }, []);

  const handleCardPlay = (card) => {
    if (gameState.currentPlayer === 'player' && gameState.momentumGauge + card.energy_cost <= 10) {
      const newState = playCard(gameState, card, gameState.opponent.teddies[0]); // For simplicity, always target the first opponent teddy
      setGameState(newState);
      setSelectedCard(null);
      // Add visual effect for card play
      setActiveEffects([...activeEffects, { name: card.name, type: 'play' }]);
      setTimeout(() => setActiveEffects(activeEffects => activeEffects.filter(effect => effect.name !== card.name)), 1000);
    }
  };

  const handleEndTurn = () => {
    const newState = endTurn(gameState);
    setGameState(newState);
    // Add visual effect for turn end
    setActiveEffects([...activeEffects, { name: 'End Turn', type: 'turn' }]);
    setTimeout(() => setActiveEffects(activeEffects => activeEffects.filter(effect => effect.name !== 'End Turn')), 1000);
  };

  const handleCardClick = (card) => {
    setSelectedCard(card);
    setShowCardDetail(true);
  };

  if (!gameState) return <div>Loading...</div>;

  const { gameOver, winner } = checkGameOver(gameState);

  if (gameOver) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-gradient-to-b from-purple-400 to-pink-500">
        <h2 className="text-4xl font-bold mb-4 text-white">{winner === 'player' ? 'You Win!' : 'You Lose!'}</h2>
        <Button onClick={onExitGame} className="bg-white text-purple-600 hover:bg-purple-100">Back to Menu</Button>
      </div>
    );
  }

  return (
    <div className="game-board p-4 bg-gradient-to-br from-purple-100 to-pink-100 min-h-screen">
      <GameInfo currentTurn={gameState.currentPlayer} momentumGauge={gameState.momentumGauge} />
      <div className="flex justify-between mb-4">
        <OpponentArea teddies={gameState.opponent.teddies} hp={gameState.opponent.hp} />
        <PlayerArea 
          teddies={gameState.player.teddies}
          hp={gameState.player.hp}
          hand={gameState.player.hand}
          onCardPlay={handleCardPlay}
          onCardClick={handleCardClick}
          momentumGauge={gameState.momentumGauge}
        />
      </div>
      <Button onClick={handleEndTurn} className="mt-4 bg-purple-500 hover:bg-purple-600 text-white">End Turn</Button>
      <Button onClick={onExitGame} className="mt-4 ml-4 bg-red-500 hover:bg-red-600 text-white">Exit Game</Button>
      <AnimatePresence>
        {showCardDetail && selectedCard && (
          <CardDetail card={selectedCard} onClose={() => setShowCardDetail(false)} />
        )}
      </AnimatePresence>
      <ActiveEffects effects={activeEffects} />
    </div>
  );
};

export default GameBoard;