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

const GameBoard = () => {
  const [playerHand, setPlayerHand] = useState<TeddyCardType[]>([]);
  const [opponentHand, setOpponentHand] = useState<TeddyCardType[]>([]);
  const [playerField, setPlayerField] = useState<TeddyCardType[]>([]);
  const [opponentField, setOpponentField] = useState<TeddyCardType[]>([]);
  const [currentTurn, setCurrentTurn] = useState<'player' | 'opponent'>('player');
  const [playerHealth, setPlayerHealth] = useState(30);
  const [opponentHealth, setOpponentHealth] = useState(30);
  const [deck, setDeck] = useState<TeddyCardType[]>([]);
  const [playerEnergy, setPlayerEnergy] = useState(1);
  const [opponentEnergy, setOpponentEnergy] = useState(1);
  const [battleLogs, setBattleLogs] = useState<string[]>([]);
  const [powerUps, setPowerUps] = useState<PowerUp[]>([]);
  const [availableCombos, setAvailableCombos] = useState<Combo[]>([]);

  const [discardPile, setDiscardPile] = useState<TeddyCardType[]>([]);

  useEffect(() => {
    initializeGame();
  }, []);

  const initializeGame = () => {
    const initialDeck = Array(30).fill(null).map(generateRandomTeddy);
    setDeck(initialDeck);
    drawInitialHands(initialDeck);
    setBattleLogs(["Game started!"]);
    setPowerUps(generatePowerUps());
  };

  const drawInitialHands = (initialDeck: TeddyCardType[]) => {
    setPlayerHand(initialDeck.slice(0, 5));
    setOpponentHand(initialDeck.slice(5, 10));
    setDeck(initialDeck.slice(10));
  };

  const playCard = (card: TeddyCardType) => {
    if (currentTurn === 'player' && playerField.length < 3 && playerEnergy >= card.energyCost) {
      setPlayerField([...playerField, card]);
      const { updatedHand, updatedDiscardPile } = discardCard(card, playerHand, discardPile);
      setPlayerHand(updatedHand);
      setDiscardPile(updatedDiscardPile);
      setPlayerEnergy(playerEnergy - card.energyCost);
      addBattleLog(`You played ${card.name}`);
    }
  };

  const attack = (attackingCard: TeddyCardType) => {
    if (currentTurn === 'player' && playerEnergy >= 1 && opponentField.length > 0) {
      const targetCard = opponentField[0];
      const damage = calculateDamage(attackingCard, targetCard);
      setOpponentHealth(prevHealth => Math.max(0, prevHealth - damage));
      setOpponentField(opponentField.filter(c => c.id !== targetCard.id));
      setPlayerEnergy(playerEnergy - 1);
      addBattleLog(`${attackingCard.name} dealt ${damage} damage to ${targetCard.name}`);
    }
  };

  const useSpecialAbility = (teddy: TeddyCardType) => {
    if (currentTurn === 'player' && playerEnergy >= 2) {
      const result = applySpecialAbility(teddy, playerHealth, opponentHealth, playerField, opponentField);
      updateGameStateAfterSpecialAbility(result);
      setPlayerEnergy(playerEnergy - 2);
      addBattleLog(`${teddy.name} used ${teddy.specialAbility.name}`);
    }
  };

  const drawCardAction = () => {
    if (deck.length === 0) {
      const newDeck = reshuffleDeck(deck, discardPile);
      setDeck(newDeck);
      setDiscardPile([]);
    }
    const { updatedDeck, updatedHand, drawnCard } = drawCard(deck, playerHand);
    if (drawnCard) {
      setDeck(updatedDeck);
      setPlayerHand(updatedHand);
      addBattleLog(`You drew ${drawnCard.name}`);
    } else {
      addBattleLog("Couldn't draw a card: hand is full or deck is empty");
    }
  };

  const endTurn = () => {
    setCurrentTurn('opponent');
    setPlayerEnergy(3);
    setTimeout(opponentTurn, 1000);
  };

  const opponentTurn = () => {
    let newOpponentEnergy = 3;
    let newOpponentField = [...opponentField];
    let newOpponentHand = [...opponentHand];
    let newPlayerField = [...playerField];
    let newPlayerHealth = playerHealth;
    let newOpponentHealth = opponentHealth;

    while (newOpponentEnergy > 0) {
      const aiMove = getAIMove(newOpponentHand, newOpponentField, newPlayerField, newOpponentEnergy, newOpponentHealth, newPlayerHealth);

      if (aiMove.action === 'play') {
        newOpponentField.push(aiMove.card);
        newOpponentHand = newOpponentHand.filter(c => c.id !== aiMove.card.id);
        newOpponentEnergy -= aiMove.card.energyCost;
        addBattleLog(`Opponent played ${aiMove.card.name}`);
      } else if (aiMove.action === 'attack') {
        if (newPlayerField.length > 0) {
          const targetCard = newPlayerField[0];
          const damage = calculateDamage(aiMove.card, targetCard);
          newPlayerField = newPlayerField.filter(c => c.id !== targetCard.id);
          addBattleLog(`${aiMove.card.name} dealt ${damage} damage to ${targetCard.name}`);
        } else {
          newPlayerHealth = Math.max(0, newPlayerHealth - aiMove.card.attack);
          addBattleLog(`${aiMove.card.name} dealt ${aiMove.card.attack} damage to you`);
        }
        newOpponentEnergy--;
      } else if (aiMove.action === 'useSpecial') {
        const result = applySpecialAbility(aiMove.card, newOpponentHealth, newPlayerHealth, newOpponentField, newPlayerField);
        if ('playerHealth' in result) newPlayerHealth = result.playerHealth as number;
        if ('opponentHealth' in result) newOpponentHealth = result.opponentHealth as number;
        if ('playerField' in result) newPlayerField = result.playerField as TeddyCardType[];
        if ('opponentField' in result) newOpponentField = result.opponentField as TeddyCardType[];
        newOpponentEnergy -= 2;
        addBattleLog(`Opponent used ${aiMove.card.specialAbility.name}`);
      } else {
        break;
      }
    }

    setOpponentField(newOpponentField);
    setOpponentHand(newOpponentHand);
    setPlayerField(newPlayerField);
    setPlayerHealth(newPlayerHealth);
    setOpponentHealth(newOpponentHealth);
    setCurrentTurn('player');
  };

  const addBattleLog = (log: string) => {
    setBattleLogs(prevLogs => [...prevLogs, log]);
  };

  const updateGameStateAfterSpecialAbility = (result: any) => {
    if ('playerHealth' in result) setPlayerHealth(result.playerHealth as number);
    if ('opponentHealth' in result) setOpponentHealth(result.opponentHealth as number);
    if ('opponentField' in result) setOpponentField(result.opponentField as TeddyCardType[]);
    if ('attack' in result || 'defense' in result) {
      setPlayerField(playerField.map(t => t.id === result.id ? result as TeddyCardType : t));
    }
  };

  const usePowerUp = (powerUp: PowerUp) => {
    const updatedState = applyPowerUp(powerUp, {
      playerEnergy,
      playerHealth,
      deck,
      playerHand,
    });
    setPlayerEnergy(updatedState.playerEnergy);
    setPlayerHealth(updatedState.playerHealth);
    setDeck(updatedState.deck);
    setPlayerHand(updatedState.playerHand);
    addBattleLog(`Used power-up: ${powerUp.name}`);
  };

  // ... keep existing useCombo function and useEffect for game over check

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
