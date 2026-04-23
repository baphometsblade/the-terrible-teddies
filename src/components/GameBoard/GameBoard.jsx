import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import TeddyCard from '../TeddyCard';
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/components/ui/use-toast";
import { motion, AnimatePresence } from 'framer-motion';
import { Howl } from 'howler';
import { useGameStore, ALL_CARDS } from '../../stores/gameStore';
import confetti from 'canvas-confetti';

// Sound effects
const sounds = {
  cardPlay: new Howl({ src: ['https://assets.mixkit.co/active_storage/sfx/2571/2571-preview.mp3'], volume: 0.3 }),
  attack: new Howl({ src: ['https://assets.mixkit.co/active_storage/sfx/2803/2803-preview.mp3'], volume: 0.4 }),
  damage: new Howl({ src: ['https://assets.mixkit.co/active_storage/sfx/2012/2012-preview.mp3'], volume: 0.3 }),
  heal: new Howl({ src: ['https://assets.mixkit.co/active_storage/sfx/1435/1435-preview.mp3'], volume: 0.3 }),
  victory: new Howl({ src: ['https://assets.mixkit.co/active_storage/sfx/1435/1435-preview.mp3'], volume: 0.5 }),
  defeat: new Howl({ src: ['https://assets.mixkit.co/active_storage/sfx/2018/2018-preview.mp3'], volume: 0.4 }),
  draw: new Howl({ src: ['https://assets.mixkit.co/active_storage/sfx/2073/2073-preview.mp3'], volume: 0.2 }),
  trap: new Howl({ src: ['https://assets.mixkit.co/active_storage/sfx/209/209-preview.mp3'], volume: 0.4 }),
};

/**
 * Enhanced GameBoard with card abilities, sound effects, and improved AI.
 *
 * Card Abilities:
 * - taunt: Forces enemies to attack this card first
 * - piercing: Ignores enemy defense
 * - shield: Takes 50% less damage
 * - stealth: Can't be targeted for one turn after played
 * - protect: Other cards can't be targeted while this is on field
 * - fury: Gains +1 attack each time it takes damage
 */
const GameBoard = ({ onBackToMenu }) => {
  // Get store data
  const {
    currentDeck,
    difficulty: aiDifficulty,
    soundEnabled: storeSoundEnabled,
    recordBattleResult,
    playerName,
  } = useGameStore();

  // Accumulate per-game stats for challenge/achievement tracking
  const battleStatsRef = useRef({ damageDealt: 0, healingDone: 0, cardsPlayed: 0 });

  // Game state
  const [phase, setPhase] = useState('draw');
  const [currentTurn, setCurrentTurn] = useState('player');
  const [turnCount, setTurnCount] = useState(1);

  // Player state
  const [playerHealth, setPlayerHealth] = useState(30);
  const [playerEnergy, setPlayerEnergy] = useState(3);
  const [playerMomentum, setPlayerMomentum] = useState(0);
  const [playerHand, setPlayerHand] = useState([]);
  const [playerField, setPlayerField] = useState([]);
  const [playerDeck, setPlayerDeck] = useState([]);
  const [playerGraveyard, setPlayerGraveyard] = useState([]);

  // Opponent state
  const [opponentHealth, setOpponentHealth] = useState(30);
  const [opponentEnergy, setOpponentEnergy] = useState(3);
  const [opponentField, setOpponentField] = useState([]);
  const [opponentDeck, setOpponentDeck] = useState([]);

  // UI state
  const [selectedCard, setSelectedCard] = useState(null);
  const [targetingMode, setTargetingMode] = useState(false);
  const [battleLog, setBattleLog] = useState([]);
  const [gameOver, setGameOver] = useState(false);
  const [winner, setWinner] = useState(null);
  const [showAbilityPopup, setShowAbilityPopup] = useState(null);
  const [rewardsShown, setRewardsShown] = useState(false);
  const [battleRewards, setBattleRewards] = useState({ xp: 0, coins: 0 });

  const { toast } = useToast();

  // Play sound helper
  const playSound = useCallback((soundName) => {
    if (storeSoundEnabled && sounds[soundName]) {
      sounds[soundName].play();
    }
  }, [storeSoundEnabled]);

  // Shuffle deck helper
  const shuffleDeck = (deck) => {
    const shuffled = [...deck];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  };

  // Add to battle log
  const addToBattleLog = useCallback((message) => {
    setBattleLog(prev => [...prev.slice(-9), { id: Date.now(), message }]);
  }, []);

  // Initialize decks
  useEffect(() => {
    // Build player deck from store's currentDeck (card IDs mapped to ALL_CARDS)
    const playerDeckCards = currentDeck
      .map(cardId => ALL_CARDS.find(c => c.id === cardId))
      .filter(Boolean)
      .map((card, idx) => ({ ...card, instanceId: `p-${card.id}-${idx}` }));

    // Fallback if no deck is set - use starter cards
    const deckToUse = playerDeckCards.length >= 5
      ? playerDeckCards
      : [
          { id: 1, name: "Teddy Troublemaker", attack: 3, defense: 2, type: 'action', cost: 2, ability: 'none', rarity: 'common' },
          { id: 2, name: "Sassy Sally", attack: 2, defense: 3, type: 'action', cost: 2, ability: 'taunt', rarity: 'common' },
          { id: 3, name: "Bear Trap", attack: 0, defense: 0, type: 'trap', cost: 2, effect: 'damage', amount: 3, rarity: 'common' },
          { id: 4, name: "Stuffing Surge", attack: 0, defense: 0, type: 'special', cost: 3, effect: 'heal', amount: 5, rarity: 'uncommon' },
          { id: 5, name: "Pillow Fighter", attack: 4, defense: 1, type: 'action', cost: 3, ability: 'piercing', rarity: 'uncommon' },
          { id: 6, name: "Cuddle Crusher", attack: 2, defense: 4, type: 'action', cost: 3, ability: 'shield', rarity: 'uncommon' },
          { id: 7, name: "Sneaky Pete", attack: 3, defense: 1, type: 'action', cost: 2, ability: 'stealth', rarity: 'rare' },
          { id: 8, name: "Honey Jar", attack: 0, defense: 0, type: 'special', cost: 2, effect: 'draw', amount: 2, rarity: 'common' },
          { id: 9, name: "Fluff Bomb", attack: 5, defense: 0, type: 'action', cost: 4, ability: 'none', rarity: 'rare' },
          { id: 10, name: "Guardian Bear", attack: 1, defense: 5, type: 'action', cost: 3, ability: 'protect', rarity: 'epic' },
        ].map((card, idx) => ({ ...card, instanceId: `p-${card.id}-${idx}` }));

    const initialPlayerDeck = shuffleDeck(deckToUse);

    // Generate opponent deck based on difficulty
    const opponentBaseStats = {
      easy: { attackMod: -1, defenseMod: -1, healthMod: -5 },
      normal: { attackMod: 0, defenseMod: 0, healthMod: 0 },
      hard: { attackMod: 1, defenseMod: 1, healthMod: 5 },
    };
    const diffMods = opponentBaseStats[aiDifficulty] || opponentBaseStats.normal;

    const opponentCards = [
      { id: 101, name: "Evil Teddy", attack: 3 + diffMods.attackMod, defense: 2 + diffMods.defenseMod, type: 'action', cost: 2, ability: 'none', rarity: 'common' },
      { id: 102, name: "Dark Fluffington", attack: 2 + diffMods.attackMod, defense: 3 + diffMods.defenseMod, type: 'action', cost: 2, ability: 'taunt', rarity: 'common' },
      { id: 103, name: "Shadow Bear", attack: 4 + diffMods.attackMod, defense: 2 + diffMods.defenseMod, type: 'action', cost: 3, ability: 'piercing', rarity: 'rare' },
      { id: 104, name: "Nightmare Cuddles", attack: 3 + diffMods.attackMod, defense: 3 + diffMods.defenseMod, type: 'action', cost: 3, ability: 'fury', rarity: 'epic' },
      { id: 105, name: "Wicked Whiskers", attack: 2 + diffMods.attackMod, defense: 2 + diffMods.defenseMod, type: 'action', cost: 2, ability: 'none', rarity: 'common' },
      { id: 106, name: "Demon Bear", attack: 4 + diffMods.attackMod, defense: 4 + diffMods.defenseMod, type: 'action', cost: 4, ability: 'shield', rarity: 'legendary' },
      { id: 107, name: "Chaos Cub", attack: 3 + diffMods.attackMod, defense: 2 + diffMods.defenseMod, type: 'action', cost: 2, ability: 'stealth', rarity: 'rare' },
      { id: 108, name: "Void Bear", attack: 5 + diffMods.attackMod, defense: 3 + diffMods.defenseMod, type: 'action', cost: 4, ability: 'piercing', rarity: 'epic' },
    ].map((card, idx) => ({ ...card, instanceId: `o-${card.id}-${idx}` }));

    const initialOpponentDeck = shuffleDeck(opponentCards);

    // Set opponent health based on difficulty
    setOpponentHealth(30 + diffMods.healthMod);

    const playerInitialHand = initialPlayerDeck.slice(0, 5);
    const playerRemainingDeck = initialPlayerDeck.slice(5);

    setPlayerHand(playerInitialHand);
    setPlayerDeck(playerRemainingDeck);

    setOpponentField([initialOpponentDeck[0]]);
    setOpponentDeck(initialOpponentDeck.slice(1));

    addToBattleLog(`Game started! Difficulty: ${aiDifficulty.toUpperCase()}`);
    addToBattleLog("Your turn.");
  }, [addToBattleLog, currentDeck, aiDifficulty]);

  // Check for game over
  useEffect(() => {
    if (playerHealth <= 0 && !gameOver) {
      setGameOver(true);
      setWinner('opponent');
      playSound('defeat');

      // Record defeat — store now handles consolation coins internally
      const { xpGain, coinsGain } = recordBattleResult(
        false,
        battleStatsRef.current.damageDealt,
        battleStatsRef.current.healingDone,
        playerHealth,
        battleStatsRef.current.cardsPlayed
      );
      setBattleRewards({ xp: xpGain, coins: coinsGain });

      toast({
        title: "Defeat!",
        description: "Your teddies have been defeated...",
        variant: "destructive",
      });
    } else if (opponentHealth <= 0 && !gameOver) {
      setGameOver(true);
      setWinner('player');
      playSound('victory');

      // Record victory — store handles XP and coin rewards
      const { xpGain, coinsGain } = recordBattleResult(
        true,
        battleStatsRef.current.damageDealt,
        battleStatsRef.current.healingDone,
        playerHealth,
        battleStatsRef.current.cardsPlayed
      );
      setBattleRewards({ xp: xpGain, coins: coinsGain });

      // Victory confetti
      confetti({
        particleCount: 150,
        spread: 100,
        origin: { y: 0.6 },
        colors: ['#FFD700', '#FFA500', '#FF6347', '#9370DB', '#00CED1'],
      });

      toast({
        title: "Victory!",
        description: "You've conquered the terrible teddies!",
      });
    }
  }, [playerHealth, opponentHealth, gameOver, toast, playSound, recordBattleResult, addXP, addCoins, aiDifficulty]);

  // Handle draw phase
  useEffect(() => {
    if (currentTurn !== 'player' || gameOver) return;

    if (phase === 'draw') {
      if (playerDeck.length > 0) {
        const drawnCard = playerDeck[0];
        setPlayerHand(prev => [...prev, drawnCard]);
        setPlayerDeck(prev => prev.slice(1));
        playSound('draw');
        addToBattleLog(`Drew ${drawnCard.name}`);
        toast({ title: "Card Drawn", description: `You drew ${drawnCard.name}` });
      } else {
        addToBattleLog("Deck is empty!");
      }
      // Remove stealth from cards that have been on field for a turn
      setPlayerField(prev => prev.map(c => ({ ...c, stealthActive: false })));
      setTimeout(() => setPhase('main'), 500);
    }
  }, [phase, currentTurn, playerDeck, gameOver, toast, addToBattleLog, playSound]);

  // Get valid targets considering abilities
  const getValidTargets = useCallback((attackerField, defenderField) => {
    // Check for taunt - must attack taunt cards first
    const tauntCards = defenderField.filter(c => c.ability === 'taunt' && !c.stealthActive);
    if (tauntCards.length > 0) {
      return tauntCards;
    }

    // Check for protect - if protect is on field, can only target protect card
    const protectCards = defenderField.filter(c => c.ability === 'protect' && !c.stealthActive);
    if (protectCards.length > 0) {
      return protectCards;
    }

    // Filter out stealth cards
    return defenderField.filter(c => !c.stealthActive);
  }, []);

  // Calculate damage with abilities
  const calculateDamage = useCallback((attacker, defender) => {
    let damage = attacker.attack;

    // Piercing ignores defense
    if (attacker.ability !== 'piercing') {
      damage = Math.max(0, damage - defender.defense);
    }

    // Shield reduces damage by 50%
    if (defender.ability === 'shield') {
      damage = Math.floor(damage / 2);
    }

    return damage;
  }, []);

  // Play a card from hand
  const playCard = (card) => {
    if (currentTurn !== 'player' || phase !== 'main') return;

    if (playerEnergy < card.cost) {
      toast({
        title: "Not enough energy!",
        description: `${card.name} costs ${card.cost} energy`,
        variant: "destructive",
      });
      return;
    }

    // Handle special cards
    if (card.type === 'special') {
      applySpecialEffect(card);
      setPlayerEnergy(prev => prev - card.cost);
      setPlayerHand(prev => prev.filter(c => c.id !== card.id));
      setPlayerGraveyard(prev => [...prev, card]);
      setPlayerMomentum(prev => Math.min(10, prev + 1));
      battleStatsRef.current.cardsPlayed += 1;
      playSound('cardPlay');
      return;
    }

    // Handle action/trap cards
    if (playerField.length >= 3) {
      toast({
        title: "Field is full!",
        description: "Remove a teddy before playing another",
        variant: "destructive",
      });
      return;
    }

    // Apply stealth on play
    const cardToPlay = card.ability === 'stealth'
      ? { ...card, stealthActive: true }
      : card;

    setPlayerField(prev => [...prev, cardToPlay]);
    setPlayerHand(prev => prev.filter(c => c.id !== card.id));
    setPlayerEnergy(prev => prev - card.cost);
    setPlayerMomentum(prev => Math.min(10, prev + 1));
    battleStatsRef.current.cardsPlayed += 1;
    playSound('cardPlay');

    // Show ability popup
    if (card.ability && card.ability !== 'none') {
      setShowAbilityPopup({ name: card.name, ability: card.ability });
      setTimeout(() => setShowAbilityPopup(null), 1500);
    }

    addToBattleLog(`Played ${card.name}${card.ability !== 'none' ? ` (${card.ability})` : ''}`);
    toast({ title: "Card Played", description: `${card.name} enters the battlefield!` });
  };

  // Apply special card effects
  const applySpecialEffect = (card) => {
    switch (card.effect) {
      case 'heal':
        setPlayerHealth(prev => Math.min(30, prev + card.amount));
        battleStatsRef.current.healingDone += card.amount;
        playSound('heal');
        addToBattleLog(`Healed ${card.amount} HP with ${card.name}`);
        toast({ title: "Healing!", description: `Restored ${card.amount} HP` });
        break;
      case 'draw':
        const cardsToDraw = Math.min(card.amount, playerDeck.length);
        const drawnCards = playerDeck.slice(0, cardsToDraw);
        setPlayerHand(prev => [...prev, ...drawnCards]);
        setPlayerDeck(prev => prev.slice(cardsToDraw));
        playSound('draw');
        addToBattleLog(`Drew ${cardsToDraw} cards with ${card.name}`);
        toast({ title: "Cards Drawn!", description: `Drew ${cardsToDraw} cards` });
        break;
      case 'buff':
        setPlayerField(prev => prev.map(c => ({ ...c, attack: c.attack + card.amount })));
        addToBattleLog(`All teddies gained +${card.amount} attack!`);
        toast({ title: "Power Up!", description: `All teddies gained +${card.amount} attack!` });
        break;
      default:
        break;
    }
  };

  // Select a card for attacking
  const selectCardForAttack = (card) => {
    if (currentTurn !== 'player' || phase !== 'battle') return;
    if (card.hasAttacked) {
      toast({ title: "Already attacked", description: `${card.name} has already attacked this turn`, variant: "destructive" });
      return;
    }

    const validTargets = getValidTargets(playerField, opponentField);
    if (validTargets.length === 0 && opponentField.length > 0) {
      toast({ title: "No valid targets", description: "All enemies have stealth!", variant: "destructive" });
      return;
    }

    setSelectedCard(card);
    setTargetingMode(true);
  };

  // Attack a target
  const attackTarget = (target) => {
    if (!selectedCard || !targetingMode) return;

    // Check if target is valid
    const validTargets = getValidTargets(playerField, opponentField);
    if (!validTargets.find(t => t.id === target.id)) {
      const tauntCard = opponentField.find(c => c.ability === 'taunt');
      if (tauntCard) {
        toast({
          title: "Must attack taunt!",
          description: `${tauntCard.name} is taunting you!`,
          variant: "destructive"
        });
      }
      return;
    }

    // Check for trap
    if (target.type === 'trap') {
      const trapDamage = target.amount || 3;
      setPlayerHealth(prev => Math.max(0, prev - trapDamage));
      setOpponentField(prev => prev.filter(c => c.id !== target.id));
      playSound('trap');
      addToBattleLog(`${target.name} triggered! Took ${trapDamage} damage`);
      toast({
        title: "Trap Triggered!",
        description: `${target.name} dealt ${trapDamage} damage to you!`,
        variant: "destructive"
      });
    } else {
      // Calculate damage with abilities
      const damage = calculateDamage(selectedCard, target);
      playSound('attack');

      // Apply fury - target gains attack when damaged
      if (target.ability === 'fury' && damage > 0) {
        setOpponentField(prev => prev.map(c =>
          c.id === target.id ? { ...c, attack: c.attack + 1 } : c
        ));
        addToBattleLog(`${target.name}'s fury activated! +1 attack`);
      }

      setOpponentHealth(prev => Math.max(0, prev - damage));
      battleStatsRef.current.damageDealt += damage;

      // Destroy the target if it takes lethal damage (simplified - always destroy on hit)
      setOpponentField(prev => prev.filter(c => c.id !== target.id));

      addToBattleLog(`${selectedCard.name} attacked ${target.name} for ${damage} damage${selectedCard.ability === 'piercing' ? ' (piercing)' : ''}`);
      toast({ title: "Attack!", description: `${selectedCard.name} dealt ${damage} damage!` });
    }

    // Mark card as having attacked
    setPlayerField(prev => prev.map(c =>
      c.id === selectedCard.id ? { ...c, hasAttacked: true } : c
    ));

    setPlayerMomentum(prev => Math.min(10, prev + 2));
    setSelectedCard(null);
    setTargetingMode(false);
  };

  // Attack opponent directly
  const attackOpponentDirectly = () => {
    if (!selectedCard || !targetingMode) return;

    const validTargets = getValidTargets(playerField, opponentField);
    if (validTargets.length > 0) {
      toast({
        title: "Cannot attack directly",
        description: "Must attack enemy teddies first!",
        variant: "destructive"
      });
      return;
    }

    playSound('attack');
    setOpponentHealth(prev => Math.max(0, prev - selectedCard.attack));
    battleStatsRef.current.damageDealt += selectedCard.attack;
    setPlayerField(prev => prev.map(c =>
      c.id === selectedCard.id ? { ...c, hasAttacked: true } : c
    ));

    addToBattleLog(`${selectedCard.name} attacked opponent directly for ${selectedCard.attack} damage!`);
    toast({ title: "Direct Attack!", description: `Dealt ${selectedCard.attack} damage to opponent!` });

    setPlayerMomentum(prev => Math.min(10, prev + 3));
    setSelectedCard(null);
    setTargetingMode(false);
  };

  // Move to battle phase
  const goToBattlePhase = () => {
    if (phase !== 'main') return;
    setPhase('battle');
    addToBattleLog("Entering battle phase...");
  };

  // End turn
  const endTurn = () => {
    setPlayerField(prev => prev.map(c => ({ ...c, hasAttacked: false })));
    setSelectedCard(null);
    setTargetingMode(false);
    setCurrentTurn('opponent');
    setPhase('end');
    addToBattleLog("Ending turn...");
    setTimeout(executeOpponentTurn, 1000);
  };

  // Opponent AI turn
  const executeOpponentTurn = () => {
    addToBattleLog("Opponent's turn!");
    setOpponentEnergy(3);

    // Remove stealth from opponent cards
    setOpponentField(prev => prev.map(c => ({ ...c, stealthActive: false })));

    // Opponent draws a card
    if (opponentDeck.length > 0) {
      const drawnCard = opponentDeck[0];
      setOpponentDeck(prev => prev.slice(1));

      if (opponentField.length < 3 && 3 >= drawnCard.cost) {
        const cardToPlay = drawnCard.ability === 'stealth'
          ? { ...drawnCard, stealthActive: true }
          : drawnCard;
        setOpponentField(prev => [...prev, cardToPlay]);
        playSound('cardPlay');
        addToBattleLog(`Opponent played ${drawnCard.name}`);
      }
    }

    // Opponent attacks
    setTimeout(() => {
      const validTargets = getValidTargets(opponentField, playerField);

      if (opponentField.length > 0) {
        opponentField.forEach(card => {
          if (card.stealthActive) return; // Stealth cards can't attack on the turn they're played

          if (validTargets.length > 0) {
            // Attack the first valid target (considering taunt/protect)
            const target = validTargets[0];

            if (target.type === 'trap') {
              const trapDamage = target.amount || 3;
              setOpponentHealth(prev => Math.max(0, prev - trapDamage));
              battleStatsRef.current.damageDealt += trapDamage;
              setPlayerField(prev => prev.filter(c => c.id !== target.id));
              playSound('trap');
              addToBattleLog(`Your ${target.name} triggered! Opponent took ${trapDamage} damage`);
            } else {
              const damage = calculateDamage(card, target);
              playSound('attack');

              // Fury activation
              if (target.ability === 'fury' && damage > 0) {
                setPlayerField(prev => prev.map(c =>
                  c.id === target.id ? { ...c, attack: c.attack + 1 } : c
                ));
                addToBattleLog(`${target.name}'s fury activated! +1 attack`);
              }

              setPlayerHealth(prev => Math.max(0, prev - damage));
              setPlayerField(prev => prev.filter(c => c.id !== target.id));
              addToBattleLog(`${card.name} attacked ${target.name} for ${damage} damage`);
            }
          } else if (playerField.length === 0) {
            // Direct attack
            playSound('attack');
            setPlayerHealth(prev => Math.max(0, prev - card.attack));
            addToBattleLog(`${card.name} attacked you directly for ${card.attack} damage!`);
          }
        });
      }

      setTimeout(() => {
        setCurrentTurn('player');
        setTurnCount(prev => prev + 1);
        setPlayerEnergy(Math.min(10, 3 + Math.floor(turnCount / 2)));
        setPhase('draw');
        addToBattleLog("Your turn!");
      }, 500);
    }, 1000);
  };

  // Cancel targeting
  const cancelTargeting = () => {
    setSelectedCard(null);
    setTargetingMode(false);
  };

  // Restart game
  const restartGame = () => {
    window.location.reload();
  };

  // Get ability description
  const getAbilityDescription = (ability) => {
    const descriptions = {
      taunt: "Forces enemies to attack this card first",
      piercing: "Ignores enemy defense",
      shield: "Takes 50% less damage",
      stealth: "Can't be targeted for one turn",
      protect: "Other cards can't be targeted",
      fury: "Gains +1 attack when damaged",
      swarm: "Costs only 1 energy",
    };
    return descriptions[ability] || "";
  };

  return (
    <div className="relative w-full h-screen bg-gradient-to-b from-amber-100 to-amber-200 overflow-hidden">
      {/* Ability Popup */}
      <AnimatePresence>
        {showAbilityPopup && (
          <motion.div
            initial={{ opacity: 0, y: -50, scale: 0.5 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.5 }}
            className="absolute top-1/3 left-1/2 transform -translate-x-1/2 z-50 bg-purple-600 text-white px-6 py-3 rounded-lg shadow-lg"
          >
            <div className="text-lg font-bold">{showAbilityPopup.name}</div>
            <div className="text-sm text-purple-200">{getAbilityDescription(showAbilityPopup.ability)}</div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Game Over Overlay */}
      <AnimatePresence>
        {gameOver && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="absolute inset-0 z-50 bg-black/80 flex items-center justify-center"
          >
            <motion.div
              initial={{ scale: 0.5, y: 50 }}
              animate={{ scale: 1, y: 0 }}
              className={`rounded-2xl p-8 text-center max-w-md w-full mx-4 ${
                winner === 'player'
                  ? 'bg-gradient-to-b from-yellow-500 to-amber-600'
                  : 'bg-gradient-to-b from-gray-700 to-gray-900'
              }`}
            >
              <motion.div
                animate={{ scale: [1, 1.2, 1], rotate: [0, 10, -10, 0] }}
                transition={{ duration: 0.5 }}
                className="text-6xl mb-4"
              >
                {winner === 'player' ? '🏆' : '💔'}
              </motion.div>
              <h2 className={`text-4xl font-bold mb-2 ${winner === 'player' ? 'text-black' : 'text-white'}`}>
                {winner === 'player' ? 'Victory!' : 'Defeat!'}
              </h2>
              <p className={`mb-6 ${winner === 'player' ? 'text-black/70' : 'text-white/70'}`}>
                {winner === 'player'
                  ? 'Your terrible teddies triumphed!'
                  : 'Better luck next time...'}
              </p>

              {/* Rewards */}
              <div className={`rounded-xl p-4 mb-6 ${winner === 'player' ? 'bg-black/20' : 'bg-white/10'}`}>
                <div className={`text-sm font-semibold mb-3 ${winner === 'player' ? 'text-black' : 'text-white'}`}>
                  Battle Rewards
                </div>
                <div className="flex justify-center gap-8">
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: 0.3 }}
                    className="text-center"
                  >
                    <div className="text-3xl mb-1">⭐</div>
                    <div className={`font-bold ${winner === 'player' ? 'text-black' : 'text-yellow-400'}`}>
                      +{battleRewards.xp} XP
                    </div>
                  </motion.div>
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: 0.5 }}
                    className="text-center"
                  >
                    <div className="text-3xl mb-1">🪙</div>
                    <div className={`font-bold ${winner === 'player' ? 'text-black' : 'text-yellow-400'}`}>
                      +{battleRewards.coins}
                    </div>
                  </motion.div>
                </div>
              </div>

              <div className="flex gap-3 justify-center">
                <Button
                  onClick={restartGame}
                  className={`${winner === 'player' ? 'bg-black text-white hover:bg-black/80' : 'bg-amber-500 hover:bg-amber-600'}`}
                >
                  Play Again
                </Button>
                {onBackToMenu && (
                  <Button
                    onClick={onBackToMenu}
                    variant="outline"
                    className={`${winner === 'player' ? 'border-black text-black hover:bg-black/10' : 'border-white text-white hover:bg-white/10'}`}
                  >
                    Menu
                  </Button>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Sound indicator */}
      <div
        className="absolute top-20 left-4 z-40 bg-white/80 p-2 rounded-full shadow"
        title={storeSoundEnabled ? "Sound on" : "Sound off"}
      >
        {storeSoundEnabled ? '🔊' : '🔇'}
      </div>

      {/* Top bar - Opponent info */}
      <div className="absolute top-0 left-0 right-0 h-16 bg-gradient-to-r from-red-900 to-red-700 flex items-center justify-between px-4 shadow-lg">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-red-500 rounded-full border-2 border-white flex items-center justify-center">
            <span className="text-white text-xl">👿</span>
          </div>
          <div>
            <div className="text-white font-bold">Evil Teddies</div>
            <div className="text-red-200 text-xs">Deck: {opponentDeck.length}</div>
          </div>
        </div>
        <div className="flex items-center space-x-4">
          <div className="text-right">
            <div className="text-white text-sm">HP</div>
            <div className="text-white font-bold text-xl">{opponentHealth}/30</div>
          </div>
          <Progress value={(opponentHealth / 30) * 100} className="w-32 h-3 bg-red-900" />
        </div>
      </div>

      {/* Opponent's field */}
      <div className="absolute top-20 left-1/2 transform -translate-x-1/2 flex justify-center space-x-3">
        {opponentField.map((card) => {
          const validTargets = getValidTargets(playerField, opponentField);
          const isValidTarget = validTargets.find(t => t.id === card.id);

          return (
            <motion.div
              key={card.id}
              initial={{ y: -50, opacity: 0 }}
              animate={{ y: 0, opacity: card.stealthActive ? 0.5 : 1 }}
              className={`relative ${targetingMode && isValidTarget ? 'cursor-crosshair ring-2 ring-red-500 ring-offset-2' : ''}`}
              onClick={() => targetingMode && isValidTarget && attackTarget(card)}
            >
              <TeddyCard teddy={card} />
              {card.stealthActive && (
                <div className="absolute top-0 left-0 right-0 bg-purple-500 text-white text-[8px] text-center rounded-t">
                  STEALTH
                </div>
              )}
              {card.ability === 'taunt' && !card.stealthActive && (
                <div className="absolute -top-2 left-1/2 transform -translate-x-1/2 bg-red-500 text-white text-[8px] px-1 rounded">
                  TAUNT
                </div>
              )}
            </motion.div>
          );
        })}
        {opponentField.length === 0 && targetingMode && (
          <motion.div
            whileHover={{ scale: 1.05 }}
            className="w-24 h-36 border-2 border-dashed border-red-400 rounded-lg flex items-center justify-center cursor-crosshair bg-red-100/50"
            onClick={attackOpponentDirectly}
          >
            <span className="text-red-500 text-xs text-center">Attack Directly</span>
          </motion.div>
        )}
      </div>

      {/* Battle log */}
      <div className="absolute top-20 right-4 w-48 bg-black/60 rounded-lg p-2 max-h-40 overflow-y-auto">
        <div className="text-amber-300 text-xs font-bold mb-1">Battle Log</div>
        {battleLog.map(entry => (
          <div key={entry.id} className="text-white text-xs py-0.5 border-b border-white/10">
            {entry.message}
          </div>
        ))}
      </div>

      {/* Main battlefield */}
      <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-4/5 h-1/3 bg-amber-300/50 rounded-xl border-4 border-amber-600 shadow-inner flex flex-col justify-between p-4">
        {/* Phase indicator */}
        <div className="absolute -top-8 left-1/2 transform -translate-x-1/2 bg-amber-600 text-white px-4 py-1 rounded-t-lg font-bold">
          Turn {turnCount} - {phase.charAt(0).toUpperCase() + phase.slice(1)} Phase
          {currentTurn === 'opponent' && ' (Opponent)'}
        </div>

        {/* Momentum gauge */}
        <div className="absolute -left-4 top-1/2 transform -translate-y-1/2 -rotate-90 origin-center">
          <div className="flex items-center space-x-2">
            <span className="text-xs text-amber-800">Momentum</span>
            <Progress value={playerMomentum * 10} className="w-24 h-2" />
            <span className="text-xs text-amber-800">{playerMomentum}/10</span>
          </div>
        </div>

        {/* Player's field */}
        <div className="flex justify-center space-x-3 mt-auto">
          {playerField.map((card) => (
            <motion.div
              key={card.id}
              whileHover={{ y: -5 }}
              className={`relative
                ${selectedCard?.id === card.id ? 'ring-2 ring-yellow-400' : ''}
                ${card.hasAttacked ? 'opacity-60' : 'cursor-pointer'}
              `}
              onClick={() => phase === 'battle' && !card.hasAttacked && selectCardForAttack(card)}
            >
              <TeddyCard teddy={card} />
              {card.hasAttacked && (
                <div className="text-center text-xs text-gray-500 mt-1">Exhausted</div>
              )}
              {card.stealthActive && (
                <div className="absolute top-0 left-0 right-0 bg-purple-500 text-white text-[8px] text-center rounded-t">
                  STEALTH
                </div>
              )}
              {card.ability === 'taunt' && !card.stealthActive && (
                <div className="absolute -top-2 left-1/2 transform -translate-x-1/2 bg-yellow-500 text-black text-[8px] px-1 rounded">
                  TAUNT
                </div>
              )}
            </motion.div>
          ))}
        </div>
      </div>

      {/* Player's hand */}
      <div className="absolute bottom-20 left-1/2 transform -translate-x-1/2 flex justify-center space-x-2">
        <AnimatePresence>
          {playerHand.map((card, index) => (
            <motion.div
              key={card.id}
              initial={{ y: 50, opacity: 0 }}
              animate={{ y: 0, opacity: 1, rotate: (index - playerHand.length / 2) * 3 }}
              exit={{ y: 50, opacity: 0 }}
              whileHover={{ y: -20, scale: 1.1, zIndex: 10 }}
              className={`cursor-pointer ${playerEnergy < card.cost ? 'opacity-50' : ''}`}
              onClick={() => phase === 'main' && playCard(card)}
            >
              <TeddyCard teddy={card} />
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Bottom bar - Player info */}
      <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-r from-green-900 to-green-700 flex items-center justify-between px-4 shadow-lg">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-gradient-to-br from-amber-400 to-orange-500 rounded-full border-2 border-white flex items-center justify-center shadow-lg">
            <span className="text-white text-xl">🧸</span>
          </div>
          <div>
            <div className="text-white font-bold">{playerName}</div>
            <div className="text-green-200 text-xs">Deck: {playerDeck.length} | Hand: {playerHand.length}</div>
          </div>
        </div>
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <span className="text-yellow-300 text-lg">⚡</span>
            <span className="text-white font-bold">{playerEnergy}</span>
          </div>
          <div className="text-right">
            <div className="text-white text-sm">HP</div>
            <div className="text-white font-bold text-xl">{playerHealth}/30</div>
          </div>
          <Progress value={(playerHealth / 30) * 100} className="w-32 h-3 bg-green-900" />
        </div>
      </div>

      {/* Game controls */}
      <div className="absolute bottom-20 right-4 space-y-2">
        {targetingMode && (
          <Button
            className="w-full bg-gray-500 hover:bg-gray-600 text-white"
            onClick={cancelTargeting}
          >
            Cancel
          </Button>
        )}
        {phase === 'main' && currentTurn === 'player' && (
          <Button
            className="w-full bg-red-500 hover:bg-red-600 text-white"
            onClick={goToBattlePhase}
          >
            ⚔️ Battle
          </Button>
        )}
        {(phase === 'main' || phase === 'battle') && currentTurn === 'player' && (
          <Button
            className="w-full bg-green-500 hover:bg-green-600 text-white"
            onClick={endTurn}
          >
            End Turn
          </Button>
        )}
      </div>

      {/* Targeting mode indicator */}
      {targetingMode && (
        <div className="absolute top-1/2 left-4 transform -translate-y-1/2 bg-yellow-500 text-black px-3 py-2 rounded-lg font-bold animate-pulse">
          Select a target for {selectedCard?.name}!
        </div>
      )}
    </div>
  );
};

export default GameBoard;
