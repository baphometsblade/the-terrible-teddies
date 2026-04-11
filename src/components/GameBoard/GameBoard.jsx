import React, { useState, useEffect, useCallback } from 'react';
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import TeddyCard from '../TeddyCard';
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/components/ui/use-toast";
import { motion, AnimatePresence } from 'framer-motion';

/**
 * Enhanced GameBoard with proper phase system, momentum gauge, and improved AI.
 *
 * Turn Structure:
 * 1. Draw Phase - Automatically draw a card
 * 2. Main Phase - Play cards, use abilities
 * 3. Battle Phase - Attack with your teddies
 * 4. End Phase - Resolve effects, opponent's turn
 */
const GameBoard = () => {
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

  const { toast } = useToast();

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
    const initialPlayerDeck = shuffleDeck([
      { id: 1, name: "Teddy Troublemaker", attack: 3, defense: 2, type: 'action', cost: 2, ability: 'none' },
      { id: 2, name: "Sassy Sally", attack: 2, defense: 3, type: 'action', cost: 2, ability: 'taunt' },
      { id: 3, name: "Bear Trap", attack: 0, defense: 0, type: 'trap', cost: 2, effect: 'damage', amount: 3 },
      { id: 4, name: "Stuffing Surge", attack: 0, defense: 0, type: 'special', cost: 3, effect: 'heal', amount: 5 },
      { id: 5, name: "Pillow Fighter", attack: 4, defense: 1, type: 'action', cost: 3, ability: 'piercing' },
      { id: 6, name: "Cuddle Crusher", attack: 2, defense: 4, type: 'action', cost: 3, ability: 'shield' },
      { id: 7, name: "Sneaky Pete", attack: 3, defense: 1, type: 'action', cost: 2, ability: 'stealth' },
      { id: 8, name: "Honey Jar", attack: 0, defense: 0, type: 'special', cost: 2, effect: 'draw', amount: 2 },
      { id: 9, name: "Fluff Bomb", attack: 5, defense: 0, type: 'action', cost: 4, ability: 'none' },
      { id: 10, name: "Guardian Bear", attack: 1, defense: 5, type: 'action', cost: 3, ability: 'protect' },
    ]);

    const initialOpponentDeck = shuffleDeck([
      { id: 101, name: "Evil Teddy", attack: 3, defense: 2, type: 'action', cost: 2, ability: 'none' },
      { id: 102, name: "Dark Fluffington", attack: 2, defense: 3, type: 'action', cost: 2, ability: 'none' },
      { id: 103, name: "Shadow Bear", attack: 4, defense: 2, type: 'action', cost: 3, ability: 'none' },
      { id: 104, name: "Nightmare Cuddles", attack: 3, defense: 3, type: 'action', cost: 3, ability: 'none' },
      { id: 105, name: "Wicked Whiskers", attack: 2, defense: 2, type: 'action', cost: 2, ability: 'none' },
    ]);

    // Draw initial hands
    const playerInitialHand = initialPlayerDeck.slice(0, 5);
    const playerRemainingDeck = initialPlayerDeck.slice(5);

    setPlayerHand(playerInitialHand);
    setPlayerDeck(playerRemainingDeck);
    setOpponentDeck(initialOpponentDeck);

    // Start opponent with some cards on field
    setOpponentField([initialOpponentDeck[0]]);
    setOpponentDeck(initialOpponentDeck.slice(1));

    addToBattleLog("Game started! Your turn.");
  }, [addToBattleLog]);

  // Check for game over
  useEffect(() => {
    if (playerHealth <= 0 && !gameOver) {
      setGameOver(true);
      setWinner('opponent');
      toast({
        title: "Defeat!",
        description: "Your teddies have been defeated...",
        variant: "destructive",
      });
    } else if (opponentHealth <= 0 && !gameOver) {
      setGameOver(true);
      setWinner('player');
      toast({
        title: "Victory!",
        description: "You've conquered the terrible teddies!",
      });
    }
  }, [playerHealth, opponentHealth, gameOver, toast]);

  // Handle draw phase
  useEffect(() => {
    if (currentTurn !== 'player' || gameOver) return;

    if (phase === 'draw') {
      if (playerDeck.length > 0) {
        const drawnCard = playerDeck[0];
        setPlayerHand(prev => [...prev, drawnCard]);
        setPlayerDeck(prev => prev.slice(1));
        addToBattleLog(`Drew ${drawnCard.name}`);
        toast({ title: "Card Drawn", description: `You drew ${drawnCard.name}` });
      } else {
        addToBattleLog("Deck is empty!");
      }
      setTimeout(() => setPhase('main'), 500);
    }
  }, [phase, currentTurn, playerDeck, gameOver, toast, addToBattleLog]);

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

    setPlayerField(prev => [...prev, card]);
    setPlayerHand(prev => prev.filter(c => c.id !== card.id));
    setPlayerEnergy(prev => prev - card.cost);
    setPlayerMomentum(prev => Math.min(10, prev + 1));
    addToBattleLog(`Played ${card.name}`);
    toast({ title: "Card Played", description: `${card.name} enters the battlefield!` });
  };

  // Apply special card effects
  const applySpecialEffect = (card) => {
    switch (card.effect) {
      case 'heal':
        setPlayerHealth(prev => Math.min(30, prev + card.amount));
        addToBattleLog(`Healed ${card.amount} HP with ${card.name}`);
        toast({ title: "Healing!", description: `Restored ${card.amount} HP` });
        break;
      case 'draw':
        const cardsToDraw = Math.min(card.amount, playerDeck.length);
        const drawnCards = playerDeck.slice(0, cardsToDraw);
        setPlayerHand(prev => [...prev, ...drawnCards]);
        setPlayerDeck(prev => prev.slice(cardsToDraw));
        addToBattleLog(`Drew ${cardsToDraw} cards with ${card.name}`);
        toast({ title: "Cards Drawn!", description: `Drew ${cardsToDraw} cards` });
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
    setSelectedCard(card);
    setTargetingMode(true);
  };

  // Attack a target
  const attackTarget = (target) => {
    if (!selectedCard || !targetingMode) return;

    // Check for trap
    if (target.type === 'trap') {
      const trapDamage = target.amount || 3;
      setPlayerHealth(prev => Math.max(0, prev - trapDamage));
      setOpponentField(prev => prev.filter(c => c.id !== target.id));
      addToBattleLog(`${target.name} triggered! Took ${trapDamage} damage`);
      toast({
        title: "Trap Triggered!",
        description: `${target.name} dealt ${trapDamage} damage to you!`,
        variant: "destructive"
      });
    } else {
      // Normal attack
      const damage = Math.max(0, selectedCard.attack - target.defense);
      setOpponentHealth(prev => Math.max(0, prev - damage));
      setOpponentField(prev => prev.filter(c => c.id !== target.id));
      addToBattleLog(`${selectedCard.name} attacked ${target.name} for ${damage} damage`);
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
    if (opponentField.length > 0) {
      toast({
        title: "Cannot attack directly",
        description: "Opponent has teddies on the field!",
        variant: "destructive"
      });
      return;
    }

    setOpponentHealth(prev => Math.max(0, prev - selectedCard.attack));
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

    // Opponent draws a card
    if (opponentDeck.length > 0) {
      const drawnCard = opponentDeck[0];
      setOpponentDeck(prev => prev.slice(1));

      if (opponentField.length < 3 && 3 >= drawnCard.cost) {
        setOpponentField(prev => [...prev, drawnCard]);
        addToBattleLog(`Opponent played ${drawnCard.name}`);
      }
    }

    // Opponent attacks
    setTimeout(() => {
      if (opponentField.length > 0) {
        opponentField.forEach(card => {
          if (playerField.length > 0) {
            const target = playerField[0];
            if (target.type === 'trap') {
              const trapDamage = target.amount || 3;
              setOpponentHealth(prev => Math.max(0, prev - trapDamage));
              setPlayerField(prev => prev.filter(c => c.id !== target.id));
              addToBattleLog(`Your ${target.name} triggered! Opponent took ${trapDamage} damage`);
            } else {
              const damage = Math.max(0, card.attack - target.defense);
              setPlayerHealth(prev => Math.max(0, prev - damage));
              setPlayerField(prev => prev.filter(c => c.id !== target.id));
              addToBattleLog(`${card.name} attacked ${target.name} for ${damage} damage`);
            }
          } else {
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

  return (
    <div className="relative w-full h-screen bg-gradient-to-b from-amber-100 to-amber-200 overflow-hidden">
      {/* Game Over Overlay */}
      <AnimatePresence>
        {gameOver && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="absolute inset-0 z-50 bg-black/70 flex items-center justify-center"
          >
            <motion.div
              initial={{ scale: 0.5 }}
              animate={{ scale: 1 }}
              className="bg-white rounded-xl p-8 text-center"
            >
              <h2 className={`text-4xl font-bold mb-4 ${winner === 'player' ? 'text-green-500' : 'text-red-500'}`}>
                {winner === 'player' ? 'Victory!' : 'Defeat!'}
              </h2>
              <p className="text-gray-600 mb-6">
                {winner === 'player'
                  ? 'Your terrible teddies triumphed!'
                  : 'Better luck next time...'}
              </p>
              <Button onClick={restartGame} className="bg-amber-500 hover:bg-amber-600">
                Play Again
              </Button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Top bar - Opponent info */}
      <div className="absolute top-0 left-0 right-0 h-16 bg-gradient-to-r from-red-900 to-red-700 flex items-center justify-between px-4 shadow-lg">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-red-500 rounded-full border-2 border-white flex items-center justify-center">
            <span className="text-white text-xl">&#128520;</span>
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
        {opponentField.map((card) => (
          <motion.div
            key={card.id}
            initial={{ y: -50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className={`${targetingMode ? 'cursor-crosshair ring-2 ring-red-500 ring-offset-2' : ''}`}
            onClick={() => targetingMode && attackTarget(card)}
          >
            <TeddyCard teddy={card} />
          </motion.div>
        ))}
        {opponentField.length === 0 && targetingMode && (
          <motion.div
            whileHover={{ scale: 1.05 }}
            className="w-20 h-32 border-2 border-dashed border-red-400 rounded-lg flex items-center justify-center cursor-crosshair bg-red-100/50"
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
              className={`
                ${selectedCard?.id === card.id ? 'ring-2 ring-yellow-400' : ''}
                ${card.hasAttacked ? 'opacity-60' : 'cursor-pointer'}
              `}
              onClick={() => phase === 'battle' && !card.hasAttacked && selectCardForAttack(card)}
            >
              <TeddyCard teddy={card} />
              {card.hasAttacked && (
                <div className="text-center text-xs text-gray-500 mt-1">Exhausted</div>
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
          <div className="w-10 h-10 bg-green-500 rounded-full border-2 border-white flex items-center justify-center">
            <span className="text-white text-xl">&#129528;</span>
          </div>
          <div>
            <div className="text-white font-bold">You</div>
            <div className="text-green-200 text-xs">Deck: {playerDeck.length} | Hand: {playerHand.length}</div>
          </div>
        </div>
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <span className="text-yellow-300 text-lg">&#9889;</span>
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
            Battle Phase
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
