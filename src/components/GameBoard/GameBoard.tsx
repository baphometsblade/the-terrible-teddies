import React, { useState, useEffect } from 'react';
import { useToast } from "@/components/ui/use-toast";
import { generateRandomTeddy, applySpecialAbility, calculateDamage } from '../../utils/gameUtils';
import { TeddyCard as TeddyCardType, PowerUp, Combo } from '../../types/types';
import PlayerArea from './PlayerArea';
import OpponentArea from './OpponentArea';
import GameControls from './GameControls';
import PowerUpSystem from './PowerUpSystem';
import ComboSystem from './ComboSystem';
import BattleLog from './BattleLog';
import TurnIndicator from './TurnIndicator';
import { motion } from 'framer-motion';
import { drawCard, discardCard, reshuffleDeck } from '../../utils/cardSystem';
import { getAIMove } from '../../utils/aiOpponent';
import { generatePowerUps, applyPowerUp } from '../../utils/powerUpSystem';
import { useGameState } from '../../hooks/useGameState';
import { useGameActions } from '../../hooks/useGameActions';

const GameBoard = () => {
  const {
    playerHand,
    opponentHand,
    playerField,
    opponentField,
    currentTurn,
    playerHealth,
    opponentHealth,
    deck,
    playerEnergy,
    opponentEnergy,
    battleLogs,
    powerUps,
    availableCombos,
    discardPile,
  } = useGameState();

  const {
    playCard,
    attack,
    useSpecialAbility,
    drawCardAction,
    endTurn,
    opponentTurn,
    addBattleLog,
    usePowerUp,
    useCombo,
  } = useGameActions();

  useEffect(() => {
  // ... keep existing useCombo function and useEffect for game over check
  }, [playerHealth, opponentHealth]);

  return (
    <motion.div 
      className="game-board p-4 bg-amber-100 rounded-lg shadow-lg"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
    >
      <TurnIndicator currentTurn={currentTurn} />
      <OpponentArea
        field={opponentField}
        health={opponentHealth}
        energy={opponentEnergy}
        handSize={opponentHand.length}
        deckSize={deck.length}
        discardPileSize={discardPile.length}
      />
      <PlayerArea
        hand={playerHand}
        field={playerField}
        health={playerHealth}
        energy={playerEnergy}
        deckSize={deck.length}
        discardPileSize={discardPile.length}
        onPlayCard={playCard}
        onUseSpecialAbility={useSpecialAbility}
        onAttack={attack}
      />
      <GameControls
        onDrawCard={drawCardAction}
        onEndTurn={endTurn}
        isPlayerTurn={currentTurn === 'player'}
        canDrawCard={deck.length > 0 && playerHand.length < 7}
      />
      <PowerUpSystem powerUps={powerUps} onUsePowerUp={usePowerUp} />
      <ComboSystem availableCombos={availableCombos} onUseCombo={useCombo} />
      <BattleLog logs={battleLogs} />
    </motion.div>
  );
};

export default GameBoard;
