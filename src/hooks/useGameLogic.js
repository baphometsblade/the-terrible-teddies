import { useState, useEffect, useCallback } from 'react';
import { useGeneratedImages } from '../integrations/supabase';
import { useToast } from "@/components/ui/use-toast";

const CARD_TYPES = {
  ACTION: 'Action',
  TRAP: 'Trap',
  SPECIAL: 'Special',
  DEFENSE: 'Defense',
  BOOST: 'Boost'
};

const INITIAL_ENERGY = 3;
const MAX_ENERGY = 10;
const INITIAL_HP = 30;
const HAND_SIZE = 5;

export const useGameLogic = (initialDeck = []) => {
  const [playerHP, setPlayerHP] = useState(INITIAL_HP);
  const [opponentHP, setOpponentHP] = useState(INITIAL_HP);
  const [playerHand, setPlayerHand] = useState([]);
  const [opponentHand, setOpponentHand] = useState([]);
  const [playerDeck, setPlayerDeck] = useState(initialDeck);
  const [opponentDeck, setOpponentDeck] = useState([]);
  const [currentTurn, setCurrentTurn] = useState('player');
  const [momentumGauge, setMomentumGauge] = useState(0);
  const [lastPlayedCard, setLastPlayedCard] = useState(null);
  const [gameLog, setGameLog] = useState([]);
  const [activeEffects, setActiveEffects] = useState({ player: [], opponent: [] });
  const [isGameOver, setIsGameOver] = useState(false);
  const [winner, setWinner] = useState(null);
  const [playerEnergy, setPlayerEnergy] = useState(INITIAL_ENERGY);
  const [opponentEnergy, setOpponentEnergy] = useState(INITIAL_ENERGY);
  const { toast } = useToast();
  const { data: allCards, isLoading: isLoadingCards } = useGeneratedImages();

  const shuffleArray = (array) => {
    const newArray = [...array];
    for (let i = newArray.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
    }
    return newArray;
  };

  const initializeGame = useCallback(() => {
    if (!allCards || allCards.length === 0) return;

    const shuffledCards = shuffleArray([...allCards]);
    setPlayerDeck(shuffledCards.slice(0, 20));
    setOpponentDeck(shuffledCards.slice(20, 40));
    setPlayerHP(INITIAL_HP);
    setOpponentHP(INITIAL_HP);
    setPlayerEnergy(INITIAL_ENERGY);
    setOpponentEnergy(INITIAL_ENERGY);
    setMomentumGauge(0);
    setGameLog([]);
    setActiveEffects({ player: [], opponent: [] });
    setIsGameOver(false);
    setWinner(null);
    setCurrentTurn('player');
    dealInitialHands();
  }, [allCards]);

  const dealInitialHands = () => {
    setPlayerHand(drawCards(HAND_SIZE, 'player'));
    setOpponentHand(drawCards(HAND_SIZE, 'opponent'));
  };

  const drawCards = (count, player) => {
    const deck = player === 'player' ? playerDeck : opponentDeck;
    const drawnCards = deck.slice(0, count);
    const newDeck = deck.slice(count);
    
    if (player === 'player') {
      setPlayerDeck(newDeck);
    } else {
      setOpponentDeck(newDeck);
    }

    return drawnCards;
  };

  const applyCardEffect = (card, player) => {
    const isOpponent = player === 'opponent';
    const target = isOpponent ? 'player' : 'opponent';
    let effectDescription = '';

    switch(card.type) {
      case CARD_TYPES.ACTION:
        const damage = card.energy_cost * 2;
        if (isOpponent) {
          setPlayerHP(prev => Math.max(0, prev - damage));
        } else {
          setOpponentHP(prev => Math.max(0, prev - damage));
        }
        effectDescription = `${card.name} deals ${damage} damage to the ${target}!`;
        break;
      case CARD_TYPES.TRAP:
        setActiveEffects(prev => ({
          ...prev,
          [player]: [...prev[player], card]
        }));
        effectDescription = `${card.name} has been set as a trap.`;
        break;
      case CARD_TYPES.SPECIAL:
        const heal = card.energy_cost;
        if (isOpponent) {
          setOpponentHP(prev => Math.min(INITIAL_HP, prev + heal));
        } else {
          setPlayerHP(prev => Math.min(INITIAL_HP, prev + heal));
        }
        effectDescription = `${card.name} heals the ${player} for ${heal} HP!`;
        break;
      case CARD_TYPES.DEFENSE:
        setActiveEffects(prev => ({
          ...prev,
          [player]: [...prev[player], card]
        }));
        effectDescription = `${card.name} provides defense for the ${player}.`;
        break;
      case CARD_TYPES.BOOST:
        setMomentumGauge(prev => Math.min(10, prev + card.energy_cost));
        effectDescription = `${card.name} boosts the momentum gauge by ${card.energy_cost}!`;
        break;
    }

    setGameLog(prev => [...prev, { player, action: effectDescription }]);
    toast({
      title: card.type,
      description: effectDescription,
    });
  };

  const playCard = (card) => {
    if (currentTurn !== 'player') return;
    if (playerEnergy < card.energy_cost) {
      toast({
        title: "Not enough Energy!",
        description: `You need ${card.energy_cost} energy to play this card.`,
        variant: "destructive",
      });
      return;
    }
    
    setPlayerEnergy(prev => prev - card.energy_cost);
    setPlayerHand(prev => prev.filter(c => c.id !== card.id));
    setLastPlayedCard(card);
    
    applyCardEffect(card, 'player');
    
    if (playerEnergy - card.energy_cost <= 0) {
      endTurn();
    }
  };

  const aiTurn = useCallback(() => {
    if (currentTurn === 'opponent') {
      setTimeout(() => {
        const playableCards = opponentHand.filter(card => card.energy_cost <= opponentEnergy);
        if (playableCards.length > 0) {
          const aiCard = playableCards[Math.floor(Math.random() * playableCards.length)];
          setOpponentHand(prev => prev.filter(c => c.id !== aiCard.id));
          setOpponentEnergy(prev => prev - aiCard.energy_cost);
          
          applyCardEffect(aiCard, 'opponent');
          
          if (opponentEnergy - aiCard.energy_cost <= 0) {
            endTurn();
          } else {
            aiTurn();
          }
        } else {
          endTurn();
        }
      }, 1000);
    }
  }, [currentTurn, opponentHand, opponentEnergy]);

  useEffect(() => {
    aiTurn();
  }, [currentTurn, aiTurn]);

  const endTurn = () => {
    setCurrentTurn(prev => prev === 'player' ? 'opponent' : 'player');
    if (currentTurn === 'player') {
      setPlayerEnergy(Math.min(MAX_ENERGY, playerEnergy + 1));
      setPlayerHand(prev => [...prev, ...drawCards(1, 'player')]);
    } else {
      setOpponentEnergy(Math.min(MAX_ENERGY, opponentEnergy + 1));
      setOpponentHand(prev => [...prev, ...drawCards(1, 'opponent')]);
    }
    checkActiveEffects();
  };

  const checkActiveEffects = () => {
    const newActiveEffects = { player: [], opponent: [] };
    ['player', 'opponent'].forEach(side => {
      activeEffects[side].forEach(effect => {
        if (effect.type === CARD_TYPES.TRAP) {
          applyCardEffect(effect, side === 'opponent' ? 'player' : 'opponent');
        } else {
          newActiveEffects[side].push(effect);
        }
      });
    });
    setActiveEffects(newActiveEffects);
  };

  const useSpecialMove = (moveName) => {
    if (momentumGauge < 10) return;

    let effectDescription = '';
    switch (moveName) {
      case "Teddy Tornado":
        setOpponentHP(prev => Math.max(0, prev - 5));
        effectDescription = "Teddy Tornado deals 5 damage to the opponent!";
        break;
      case "Fluff Armor":
        setActiveEffects(prev => ({
          ...prev,
          player: [...prev.player, { type: CARD_TYPES.DEFENSE, energy_cost: 5, name: "Fluff Armor" }]
        }));
        effectDescription = "Fluff Armor provides 5 defense points!";
        break;
      case "Cuddle Heal":
        setPlayerHP(prev => Math.min(INITIAL_HP, prev + 5));
        effectDescription = "Cuddle Heal restores 5 HP!";
        break;
    }

    setMomentumGauge(0);
    setGameLog(prev => [...prev, { player: 'player', action: effectDescription }]);
    toast({
      title: "Special Move",
      description: effectDescription,
    });
    endTurn();
  };

  useEffect(() => {
    if (playerHP <= 0 || opponentHP <= 0) {
      setIsGameOver(true);
      setWinner(playerHP > 0 ? 'player' : 'opponent');
    }
  }, [playerHP, opponentHP]);

  useEffect(() => {
    if (!isLoadingCards && allCards && allCards.length > 0) {
      initializeGame();
    }
  }, [isLoadingCards, allCards, initializeGame]);

  return {
    playerHP,
    opponentHP,
    playerHand,
    opponentHand,
    currentTurn,
    momentumGauge,
    lastPlayedCard,
    gameLog,
    playCard,
    endTurn,
    isGameOver,
    winner,
    useSpecialMove,
    initializeGame,
    playerEnergy,
    opponentEnergy,
  };
};