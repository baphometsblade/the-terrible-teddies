import { useState, useEffect } from 'react';
import { TeddyCard, PowerUp, Combo, Achievement } from '../types/types';
import { generateRandomTeddy } from '../utils/gameUtils';
import { generatePowerUps } from '../utils/powerUpSystem';
import { WeatherEffect, getRandomWeather } from '../utils/weatherSystem';
import { getInitialAchievements } from '../utils/achievementSystem';

export const useGameState = () => {
  const [playerHand, setPlayerHand] = useState<TeddyCard[]>([]);
  const [opponentHand, setOpponentHand] = useState<TeddyCard[]>([]);
  const [playerField, setPlayerField] = useState<TeddyCard[]>([]);
  const [opponentField, setOpponentField] = useState<TeddyCard[]>([]);
  const [currentTurn, setCurrentTurn] = useState<'player' | 'opponent'>('player');
  const [playerHealth, setPlayerHealth] = useState(30);
  const [opponentHealth, setOpponentHealth] = useState(30);
  const [deck, setDeck] = useState<TeddyCard[]>([]);
  const [playerEnergy, setPlayerEnergy] = useState(1);
  const [opponentEnergy, setOpponentEnergy] = useState(1);
  const [battleLogs, setBattleLogs] = useState<string[]>([]);
  const [powerUps, setPowerUps] = useState<PowerUp[]>([]);
  const [availableCombos, setAvailableCombos] = useState<Combo[]>([]);
  const [discardPile, setDiscardPile] = useState<TeddyCard[]>([]);
  const [weather, setWeather] = useState<WeatherEffect>(getRandomWeather());
  const [achievements, setAchievements] = useState<Achievement[]>(getInitialAchievements());

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

  const drawInitialHands = (initialDeck: TeddyCard[]) => {
    setPlayerHand(initialDeck.slice(0, 5));
    setOpponentHand(initialDeck.slice(5, 10));
    setDeck(initialDeck.slice(10));
  };

  return {
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
    powerUps,
    setPowerUps,
    availableCombos,
    setAvailableCombos,
    discardPile,
    setDiscardPile,
    weather,
    setWeather,
    achievements,
    setAchievements,
  };
};
