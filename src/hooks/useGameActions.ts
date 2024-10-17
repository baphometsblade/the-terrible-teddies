import { useToast } from "@/components/ui/use-toast";
import { TeddyCard, PowerUp, Combo } from '../types/types';
import { calculateDamage, applySpecialAbility } from '../utils/gameUtils';
import { drawCard, discardCard, reshuffleDeck } from '../utils/cardSystem';
import { getAIMove } from '../utils/aiOpponent';
import { applyPowerUp } from '../utils/powerUpSystem';
import { useGameState } from './useGameState';
import { gainExperience } from '../utils/levelSystem';
import { getRandomWeather, applyWeatherEffect, WeatherEffect } from '../utils/weatherSystem';
import { checkAchievements, Achievement } from '../utils/achievementSystem';

export const useGameActions = () => {
  const {
    playerHand,
    setPlayerHand,
    opponentHand,
    setOpponentHand,
    playerField,
    setPlayerField,
    opponentField,
    setOpponentField,
    currentTurn,
    setCurrentTurn,
    playerHealth,
    setPlayerHealth,
    opponentHealth,
    setOpponentHealth,
    deck,
    setDeck,
    playerEnergy,
    setPlayerEnergy,
    opponentEnergy,
    setOpponentEnergy,
    battleLogs,
    setBattleLogs,
    discardPile,
    setDiscardPile,
    setWeather,
    achievements,
    setAchievements,
  } = useGameState();

  const { toast } = useToast();

  const playCard = (card: TeddyCard) => {
    if (currentTurn === 'player' && playerField.length < 3 && playerEnergy >= card.energyCost) {
      setPlayerField([...playerField, card]);
      const { updatedHand, updatedDiscardPile } = discardCard(card, playerHand, discardPile);
      setPlayerHand(updatedHand);
      setDiscardPile(updatedDiscardPile);
      setPlayerEnergy(playerEnergy - card.energyCost);
      addBattleLog(`You played ${card.name}`);
    }
  };

  const attack = (attackingCard: TeddyCard) => {
    if (currentTurn === 'player' && playerEnergy >= 1 && opponentField.length > 0) {
      const targetCard = opponentField[0];
      const weather = getRandomWeather();
      setWeather(weather);
      const baseDamage = calculateDamage(attackingCard, targetCard);
      const weatherAdjustedDamage = applyWeatherEffect(attackingCard, targetCard, weather);
      const finalDamage = Math.max(1, weatherAdjustedDamage);

      setOpponentHealth(prevHealth => Math.max(0, prevHealth - finalDamage));
      setOpponentField(opponentField.filter(c => c.id !== targetCard.id));
      setPlayerEnergy(playerEnergy - 1);
      addBattleLog(`Weather changed to ${weather.name}. ${weather.description}`);
      addBattleLog(`${attackingCard.name} dealt ${finalDamage} damage to ${targetCard.name}`);
      
      const updatedAttackingCard = gainExperience(attackingCard, finalDamage);
      setPlayerField(prevField => prevField.map(card => 
        card.id === updatedAttackingCard.id ? updatedAttackingCard : card
      ));
      
      if (updatedAttackingCard.level > attackingCard.level) {
        addBattleLog(`${updatedAttackingCard.name} leveled up to level ${updatedAttackingCard.level}!`);
      }
    }
  };

  const useSpecialAbility = (teddy: TeddyCard) => {
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
        if ('playerField' in result) newPlayerField = result.playerField as TeddyCard[];
        if ('opponentField' in result) newOpponentField = result.opponentField as TeddyCard[];
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
    if ('opponentField' in result) setOpponentField(result.opponentField as TeddyCard[]);
    if ('attack' in result || 'defense' in result) {
      setPlayerField(playerField.map(t => t.id === result.id ? result as TeddyCard : t));
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

  const useCombo = (combo: Combo) => {
    // Implement combo logic
    addBattleLog(`Used combo: ${combo.name}`);
  };

  return {
    playCard,
    attack,
    useSpecialAbility,
    drawCardAction,
    endTurn,
    opponentTurn,
    addBattleLog,
    usePowerUp,
    useCombo,
  };
};
