import React, { useState, useEffect } from 'react';
import { useToast } from "@/components/ui/use-toast";
import { generateRandomTeddy, applySpecialAbility, calculateDamage } from '../../utils/gameUtils';
import { TeddyCard as TeddyCardType } from '../../types/types';
import PlayerArea from './PlayerArea';
import OpponentArea from './OpponentArea';
import GameControls from './GameControls';
import PowerUpSystem from './PowerUpSystem';
import ComboSystem from './ComboSystem';
import BattleLog from './BattleLog';

const GameBoard = () => {
  const [playerHand, setPlayerHand] = useState<TeddyCardType[]>([]);
  const [opponentHand, setOpponentHand] = useState<TeddyCardType[]>([]);
  const [playerField, setPlayerField] = useState<TeddyCardType[]>([]);
  const [opponentField, setOpponentField] = useState<TeddyCardType[]>([]);
  const [currentTurn, setCurrentTurn] = useState<'player' | 'opponent'>('player');
  const [playerHealth, setPlayerHealth] = useState(30);
  const [opponentHealth, setOpponentHealth] = useState(30);
  const [deck, setDeck] = useState<TeddyCardType[]>([]);
  const [playerEnergy, setPlayerEnergy] = useState(3);
  const [opponentEnergy, setOpponentEnergy] = useState(3);
  const [battleLogs, setBattleLogs] = useState<string[]>([]);
  const [powerUps, setPowerUps] = useState([]);
  const [availableCombos, setAvailableCombos] = useState([]);
  const { toast } = useToast();

  useEffect(() => {
    initializeGame();
  }, []);

  const initializeGame = () => {
    const initialDeck = Array(10).fill(null).map(generateRandomTeddy);
    setDeck(initialDeck);
    setPlayerHand(initialDeck.slice(0, 5));
    setOpponentHand(initialDeck.slice(5, 10));
    setBattleLogs(["Game started!"]);
  };

  const playCard = (card: TeddyCardType) => {
    if (currentTurn === 'player' && playerField.length < 3 && playerEnergy >= 1) {
      setPlayerField([...playerField, card]);
      setPlayerHand(playerHand.filter(c => c.id !== card.id));
      setPlayerEnergy(playerEnergy - 1);
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

  const drawCard = () => {
    if (deck.length > 0 && playerHand.length < 7) {
      const drawnCard = deck[0];
      setPlayerHand([...playerHand, drawnCard]);
      setDeck(deck.slice(1));
      addBattleLog(`You drew ${drawnCard.name}`);
    } else {
      toast({
        title: "Cannot Draw",
        description: deck.length === 0 ? "Deck is empty!" : "Hand is full!",
        variant: "destructive",
      });
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

    // Play cards
    while (newOpponentEnergy > 0 && newOpponentField.length < 3 && newOpponentHand.length > 0) {
      const cardToPlay = newOpponentHand[0];
      newOpponentField.push(cardToPlay);
      newOpponentHand = newOpponentHand.slice(1);
      newOpponentEnergy--;
      toast({
        title: "Opponent's Turn",
        description: `Opponent played ${cardToPlay.name}`,
      });
    }

    // Attack
    for (const attackingCard of newOpponentField) {
      if (newOpponentEnergy > 0 && newPlayerField.length > 0) {
        const targetCard = newPlayerField[0];
        const damage = calculateDamage(attackingCard, targetCard);
        newPlayerHealth = Math.max(0, newPlayerHealth - damage);
        newPlayerField = newPlayerField.filter(c => c.id !== targetCard.id);
        newOpponentEnergy--;
        toast({
          title: "Opponent's Attack",
          description: `${attackingCard.name} dealt ${damage} damage to ${targetCard.name}`,
        });
      } else if (newOpponentEnergy > 0) {
        newPlayerHealth = Math.max(0, newPlayerHealth - attackingCard.attack);
        newOpponentEnergy--;
        toast({
          title: "Opponent's Attack",
          description: `${attackingCard.name} dealt ${attackingCard.attack} damage to you`,
        });
      }
    }

    // Use special abilities
    for (const teddy of newOpponentField) {
      if (newOpponentEnergy >= 2) {
        const result = applySpecialAbility(teddy, opponentHealth, newPlayerHealth, newOpponentField, newPlayerField);
        if ('playerHealth' in result) newPlayerHealth = result.playerHealth as number;
        if ('opponentHealth' in result) setOpponentHealth(result.opponentHealth as number);
        if ('playerField' in result) newPlayerField = result.playerField as TeddyCardType[];
        if ('attack' in result || 'defense' in result) {
          newOpponentField = newOpponentField.map(t => t.id === teddy.id ? result as TeddyCardType : t);
        }
        newOpponentEnergy -= 2;
        toast({
          title: "Opponent's Special Ability",
          description: `${teddy.name} used ${teddy.specialAbility.name}`,
        });
      }
    }

    setOpponentField(newOpponentField);
    setOpponentHand(newOpponentHand);
    setPlayerField(newPlayerField);
    setPlayerHealth(newPlayerHealth);
    setCurrentTurn('player');
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

  const usePowerUp = (powerUp: any) => {
    // Implement power-up logic
    addBattleLog(`Used power-up: ${powerUp.name}`);
  };

  const useCombo = (combo: any) => {
    // Implement combo logic
    addBattleLog(`Used combo: ${combo.name}`);
  };

  useEffect(() => {
    if (playerHealth <= 0 || opponentHealth <= 0) {
      toast({
        title: "Game Over",
        description: playerHealth <= 0 ? "You lost!" : "You won!",
        variant: playerHealth <= 0 ? "destructive" : "success",
      });
    }
  }, [playerHealth, opponentHealth, toast]);

  return (
    <div className="game-board">
      <OpponentArea
        field={opponentField}
        health={opponentHealth}
        energy={opponentEnergy}
      />
      <PlayerArea
        hand={playerHand}
        field={playerField}
        health={playerHealth}
        energy={playerEnergy}
        onPlayCard={playCard}
        onUseSpecialAbility={useSpecialAbility}
        onAttack={attack}
      />
      <GameControls
        onDrawCard={drawCard}
        onEndTurn={endTurn}
        isPlayerTurn={currentTurn === 'player'}
        canDrawCard={deck.length > 0 && playerHand.length < 7}
      />
      <PowerUpSystem powerUps={powerUps} onUsePowerUp={usePowerUp} />
      <ComboSystem availableCombos={availableCombos} onUseCombo={useCombo} />
      <BattleLog logs={battleLogs} />
    </div>
  );
};

export default GameBoard;
