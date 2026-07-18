import { useState, useEffect, useCallback, useRef } from 'react';
import { Button } from "@/components/ui/button";
import TeddyCard from '../TeddyCard';
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/components/ui/use-toast";
import { motion, AnimatePresence } from 'framer-motion';
import { Howl } from 'howler';
import { useGameStore, ALL_CARDS } from '../../stores/gameStore';
import confetti from 'canvas-confetti';
import { resolveCreatureHit } from '../../utils/battleUtils';
import { syncBattleResult } from '../../utils/supabaseClient';
import { chooseOpponentPlays, chooseAttackTarget, OPPONENT_ENERGY_BY_DIFFICULTY } from '../../utils/opponentAI';
import { pressable } from '@/lib/a11y';
import { useDialog } from '@/hooks/useDialog';

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

// Cap the hand so unbounded draw (per-turn + draw specials) can't overflow the
// fixed-width hand layout into an unclickable, off-screen stack.
const MAX_HAND_SIZE = 10;

// Stamp a creature's starting durability when it enters the field. `defense` is
// the HP pool in the creature-HP combat model; `currentHp` tracks the remaining
// pool as it takes hits (see resolveCreatureHit).
const withHp = (card) => ({ ...card, currentHp: card.defense });

// The game-over overlay mounts conditionally, so it hosts its own useDialog
// (the hook must live in a component that mounts with the overlay). Gives the
// end screen dialog semantics + focus containment, so keyboard users can't
// tab into the finished board behind it.
const GameOverDialog = ({ label, onEscape, children }) => {
  const ref = useDialog(onEscape);
  return (
    <motion.div
      ref={ref}
      role="dialog"
      aria-modal="true"
      aria-label={label}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="absolute inset-0 z-50 bg-black/80 flex items-center justify-center"
    >
      {children}
    </motion.div>
  );
};

/**
 * Enhanced GameBoard with card abilities, sound effects, and improved AI.
 *
 * Combat model: a creature's `defense` is its HP pool (tracked per board
 * instance as `currentHp`). An attack deals the attacker's `attack` to that
 * pool; the creature survives a non-lethal hit and only dies when HP hits 0,
 * at which point trample overkill spills to the owner's face. Both sides
 * resolve identically via resolveCreatureHit.
 *
 * Card Abilities:
 * - taunt: Forces enemies to attack this card first
 * - piercing: Cuts through shield (deals full damage)
 * - shield: Takes 50% less damage (halved, floored)
 * - stealth: Can't be targeted for one turn after played
 * - protect: Other cards can't be targeted while this is on field
 * - fury: Gains +1 attack each time it survives a hit
 */
const GameBoard = ({ onBackToMenu, onOpenShop }) => {
  // Get store data
  const {
    currentDeck,
    difficulty: aiDifficulty,
    soundEnabled: storeSoundEnabled,
    recordBattleResult,
    playerName,
    gems,
    cardPacks,
  } = useGameStore();

  // Accumulate per-game stats for challenge/achievement tracking
  const battleStatsRef = useRef({ damageDealt: 0, healingDone: 0, cardsPlayed: 0 });

  // Track timeouts so queued turn steps can be cancelled on restart/concede/
  // game-over/unmount, instead of firing later and mutating a fresh game.
  const timeoutsRef = useRef([]);
  const safeTimeout = useCallback((fn, delay) => {
    const id = setTimeout(fn, delay);
    timeoutsRef.current.push(id);
    return id;
  }, []);
  const clearAllTimeouts = useCallback(() => {
    timeoutsRef.current.forEach(clearTimeout);
    // Clear in place so the unmount cleanup's captured reference stays valid.
    timeoutsRef.current.length = 0;
  }, []);

  useEffect(() => {
    // Capture the array reference so the cleanup clears the same list we push
    // into (it's mutated in place, never reassigned), satisfying the rule that
    // warns against reading a possibly-changed ref in cleanup.
    const timeouts = timeoutsRef.current;
    return () => {
      timeouts.forEach(clearTimeout);
    };
  }, []);

  // Game state
  const [gameId, setGameId] = useState(0); // Used to trigger deck re-initialization on restart
  // False until the deck-init effect has dealt the opening hand, so the draw
  // phase never runs against the pre-initialization empty deck.
  const [deckReady, setDeckReady] = useState(false);
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

  // Opponent state
  const [opponentHealth, setOpponentHealth] = useState(30);
  const [opponentField, setOpponentField] = useState([]);
  const [opponentDeck, setOpponentDeck] = useState([]);

  // UI state
  const [selectedCard, setSelectedCard] = useState(null);
  const [targetingMode, setTargetingMode] = useState(false);
  const [battleLog, setBattleLog] = useState([]);
  const [gameOver, setGameOver] = useState(false);
  const [winner, setWinner] = useState(null);
  const [showAbilityPopup, setShowAbilityPopup] = useState(null);
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

  // Add to battle log. Ids must be unique — several entries are appended in
  // the same millisecond during the opponent's turn, so Date.now() collides
  // and duplicate React keys corrupt the rendered list.
  const logIdRef = useRef(0);
  const addToBattleLog = useCallback((message) => {
    // Capture the id now — reading the ref inside the updater would give two
    // batched updates the same (final) value and recreate the duplicate keys.
    logIdRef.current += 1;
    const id = logIdRef.current;
    setBattleLog(prev => [...prev.slice(-9), { id, message }]);
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

    setOpponentField([withHp(initialOpponentDeck[0])]);
    setOpponentDeck(initialOpponentDeck.slice(1));

    addToBattleLog(`Game started! Difficulty: ${aiDifficulty.toUpperCase()}`);
    addToBattleLog("Your turn.");
    setDeckReady(true);
  }, [addToBattleLog, currentDeck, aiDifficulty, gameId]);

  // Check for game over. Opponent death is checked first so that a simultaneous
  // lethal (both reach 0 in the same commit) counts as a win for the player who
  // dealt it, rather than an unconditional loss.
  useEffect(() => {
    if (gameOver) return;
    if (opponentHealth <= 0) {
      clearAllTimeouts(); // cancel any queued opponent-turn steps
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

      // Sync to server (fire and forget - don't block UI)
      syncBattleResult(true, battleStatsRef.current.damageDealt, battleStatsRef.current.healingDone, coinsGain)
        .catch(err => console.error('Battle sync failed:', err));

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
    } else if (playerHealth <= 0) {
      clearAllTimeouts(); // cancel any queued opponent-turn steps
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

      // Sync to server (fire and forget - don't block UI)
      syncBattleResult(false, battleStatsRef.current.damageDealt, battleStatsRef.current.healingDone, coinsGain)
        .catch(err => console.error('Battle sync failed:', err));

      toast({
        title: "Defeat!",
        description: "Your teddies have been defeated...",
        variant: "destructive",
      });
    }
  }, [playerHealth, opponentHealth, gameOver, toast, playSound, recordBattleResult, aiDifficulty, clearAllTimeouts]);

  // Handle draw phase. The draw mutates playerDeck/playerHand — this effect's
  // own dependencies — so without a per-turn guard it re-fires during the
  // 500ms draw window and keeps drawing until the phase flips (draining the
  // deck; and StrictMode's double-invoke would add the same card twice,
  // producing duplicate hand keys). The ref guarantees exactly one draw per
  // turn per game.
  const lastDrawRef = useRef(null);
  useEffect(() => {
    if (!deckReady || currentTurn !== 'player' || gameOver || phase !== 'draw') return;

    const drawKey = `${gameId}-${turnCount}`;
    if (lastDrawRef.current === drawKey) return;
    lastDrawRef.current = drawKey;

    if (playerDeck.length === 0) {
      addToBattleLog("Deck is empty!");
    } else if (playerHand.length >= MAX_HAND_SIZE) {
      addToBattleLog(`Hand is full (${MAX_HAND_SIZE}) — skipped draw`);
    } else {
      const drawnCard = playerDeck[0];
      setPlayerHand(prev => [...prev, drawnCard]);
      setPlayerDeck(prev => prev.slice(1));
      playSound('draw');
      addToBattleLog(`Drew ${drawnCard.name}`);
      toast({ title: "Card Drawn", description: `You drew ${drawnCard.name}` });
    }
    // Remove stealth from cards that have been on field for a turn
    setPlayerField(prev => prev.map(c => ({ ...c, stealthActive: false })));
    safeTimeout(() => setPhase('main'), 500);
  }, [deckReady, phase, currentTurn, turnCount, gameId, playerDeck, playerHand.length, gameOver, toast, addToBattleLog, playSound, safeTimeout]);

  // Get valid attack targets considering abilities. Traps are excluded: they
  // are not creatures and spring on their own, so they must never gate a direct
  // attack — otherwise a board of only traps soft-locks the game.
  const getValidTargets = useCallback((attackerField, defenderField) => {
    const creatures = defenderField.filter(c => c.type !== 'trap' && !c.stealthActive);

    // Taunt must be attacked first
    const tauntCards = creatures.filter(c => c.ability === 'taunt');
    if (tauntCards.length > 0) return tauntCards;

    // Protect — only the protector can be targeted while it's on the field
    const protectCards = creatures.filter(c => c.ability === 'protect');
    if (protectCards.length > 0) return protectCards;

    return creatures;
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
      setPlayerHand(prev => prev.filter(c => c.instanceId !== card.instanceId));
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

    // Stamp starting HP; apply stealth on play.
    const cardToPlay = card.ability === 'stealth'
      ? { ...withHp(card), stealthActive: true }
      : withHp(card);

    setPlayerField(prev => [...prev, cardToPlay]);
    setPlayerHand(prev => prev.filter(c => c.instanceId !== card.instanceId));
    setPlayerEnergy(prev => prev - card.cost);
    setPlayerMomentum(prev => Math.min(10, prev + 1));
    battleStatsRef.current.cardsPlayed += 1;
    playSound('cardPlay');

    // Show ability popup
    if (card.ability && card.ability !== 'none') {
      setShowAbilityPopup({ name: card.name, ability: card.ability });
      safeTimeout(() => setShowAbilityPopup(null), 1500);
    }

    addToBattleLog(`Played ${card.name}${card.ability && card.ability !== 'none' ? ` (${card.ability})` : ''}`);
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
      case 'draw': {
        const cardsToDraw = Math.min(card.amount, playerDeck.length, Math.max(0, MAX_HAND_SIZE - playerHand.length));
        const drawnCards = playerDeck.slice(0, cardsToDraw);
        setPlayerHand(prev => [...prev, ...drawnCards]);
        setPlayerDeck(prev => prev.slice(cardsToDraw));
        playSound('draw');
        addToBattleLog(`Drew ${cardsToDraw} cards with ${card.name}`);
        toast({ title: "Cards Drawn!", description: `Drew ${cardsToDraw} cards` });
        break;
      }
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
    if (card.type === 'trap') {
      toast({ title: "Traps can't attack", description: `${card.name} springs automatically when an enemy strikes it.`, variant: "destructive" });
      return;
    }
    if (card.hasAttacked) {
      toast({ title: "Already attacked", description: `${card.name} has already attacked this turn`, variant: "destructive" });
      return;
    }

    // Selection always proceeds; the attack step enforces taunt/protect and
    // allows a direct hit when only traps or stealthed cards remain.
    setSelectedCard(card);
    setTargetingMode(true);
  };

  // Attack a target
  const attackTarget = (target) => {
    if (!selectedCard || !targetingMode) return;

    // Only creatures are valid targets (traps spring on their own and are
    // triggered by going face — see attackOpponentDirectly).
    const validTargets = getValidTargets(playerField, opponentField);
    if (!validTargets.find(t => t.instanceId === target.instanceId)) {
      const tauntCard = opponentField.find(c => c.ability === 'taunt' && c.type !== 'trap');
      if (tauntCard) {
        toast({
          title: "Must attack taunt!",
          description: `${tauntCard.name} is taunting you!`,
          variant: "destructive"
        });
      }
      return;
    }

    // Resolve against the target's HP: it survives a non-lethal hit (and its
    // fury fires), or dies and trample overkill spills to the opponent's face.
    const { survivor, overkill, dmg } = resolveCreatureHit(selectedCard, target);
    playSound('attack');
    battleStatsRef.current.damageDealt += dmg;

    if (survivor) {
      setOpponentField(prev => prev.map(c => c.instanceId === target.instanceId ? survivor : c));
      if (target.ability === 'fury') addToBattleLog(`${target.name}'s fury activated! +1 attack`);
      addToBattleLog(`${selectedCard.name} hit ${target.name} for ${dmg} (${survivor.currentHp} HP left)`);
      toast({ title: "Hit!", description: `${target.name} has ${survivor.currentHp} HP left.` });
    } else {
      setOpponentField(prev => prev.filter(c => c.instanceId !== target.instanceId));
      if (overkill > 0) setOpponentHealth(prev => Math.max(0, prev - overkill));
      addToBattleLog(`${selectedCard.name} destroyed ${target.name}${overkill > 0 ? ` (${overkill} trampled through)` : ''}`);
      toast({ title: "Destroyed!", description: `${target.name} is down${overkill > 0 ? ` — ${overkill} to the enemy!` : ''}` });
    }

    // Mark card as having attacked
    setPlayerField(prev => prev.map(c =>
      c.instanceId === selectedCard.instanceId ? { ...c, hasAttacked: true } : c
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

    // No blocking creatures. If the opponent has a trap on the field, the attack
    // springs it (the attacker takes the trap damage and the trap is consumed)
    // instead of hitting face — so traps stay meaningful without permanently
    // gating the attack: the next strike gets through.
    const trap = opponentField.find(c => c.type === 'trap');
    if (trap) {
      const trapDamage = trap.amount || 3;
      setPlayerHealth(prev => Math.max(0, prev - trapDamage));
      setOpponentField(prev => prev.filter(c => c.instanceId !== trap.instanceId));
      playSound('trap');
      addToBattleLog(`${trap.name} sprang! You took ${trapDamage} damage`);
      toast({ title: "Trap Triggered!", description: `${trap.name} dealt ${trapDamage} damage to you!`, variant: "destructive" });
    } else {
      playSound('attack');
      setOpponentHealth(prev => Math.max(0, prev - selectedCard.attack));
      battleStatsRef.current.damageDealt += selectedCard.attack;
      addToBattleLog(`${selectedCard.name} attacked opponent directly for ${selectedCard.attack} damage!`);
      toast({ title: "Direct Attack!", description: `Dealt ${selectedCard.attack} damage to opponent!` });
    }

    setPlayerField(prev => prev.map(c =>
      c.instanceId === selectedCard.instanceId ? { ...c, hasAttacked: true } : c
    ));

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
    // Guard like every sibling handler: only the player, on their own turn, ends
    // it — so a stray call during the opponent's turn can't queue a second
    // executeOpponentTurn.
    if (currentTurn !== 'player') return;
    setPlayerField(prev => prev.map(c => ({ ...c, hasAttacked: false })));
    setSelectedCard(null);
    setTargetingMode(false);
    setCurrentTurn('opponent');
    setPhase('end');
    addToBattleLog("Ending turn...");
    safeTimeout(executeOpponentTurn, 1000);
  };

  // Opponent AI turn
  const executeOpponentTurn = () => {
    addToBattleLog("Opponent's turn!");

    // Remove stealth from opponent cards. Compute the cleared field once and
    // use it for BOTH the state update and the attack loop below — the loop
    // otherwise iterates this closure's stale snapshot, where a stealth card
    // played last turn still reads stealthActive and skips an extra full turn
    // of attacks.
    const activeOpponentField = opponentField.map(c => ({ ...c, stealthActive: false }));
    setOpponentField(prev => prev.map(c => ({ ...c, stealthActive: false })));

    // Opponent plays every card it can afford within its per-turn energy
    // budget (difficulty-scaled) while the field has room. Only played cards
    // leave the deck, so a full board never mills it.
    const energyBudget = OPPONENT_ENERGY_BY_DIFFICULTY[aiDifficulty] ?? OPPONENT_ENERGY_BY_DIFFICULTY.normal;
    const { plays, remainingDeck } = chooseOpponentPlays(opponentDeck, opponentField.length, energyBudget);
    if (plays.length > 0) {
      setOpponentDeck(remainingDeck);
      const played = plays.map(c => (c.ability === 'stealth' ? { ...withHp(c), stealthActive: true } : withHp(c)));
      setOpponentField(prev => [...prev, ...played]);
      playSound('cardPlay');
      plays.forEach(c => addToBattleLog(`Opponent played ${c.name}`));
    }

    // Opponent attacks — resolve against a live working copy so each attacker
    // re-evaluates targets (taunt/protect) as creatures fall, instead of every
    // attacker piling onto a single stale target and the rest no-opping.
    safeTimeout(() => {
      // Clear hasAttacked in the working copy: endTurn already reset it in
      // state, but this closure predates that render, and the unconditional
      // write-back below would otherwise restore hasAttacked:true — bricking
      // any attacker that survives an opponent turn as permanently Exhausted.
      let livePlayerField = playerField.map(c => ({ ...c, hasAttacked: false }));
      let faceDamage = 0;
      let trapDamageToOpponent = 0;
      const logs = [];

      activeOpponentField.forEach(card => {
        if (card.stealthActive) return; // can't attack the turn it's played

        // Creature blockers (taunt/protect/normal) must be dealt with first.
        const targets = getValidTargets(opponentField, livePlayerField);

        if (targets.length > 0) {
          // Attack the biggest threat; resolve against its HP just like the
          // player's attackTarget — it survives (fury fires) or dies with trample
          // overkill carrying through to the player's face.
          const target = chooseAttackTarget(targets);
          const { survivor, overkill, dmg } = resolveCreatureHit(card, target);
          playSound('attack');
          if (survivor) {
            livePlayerField = livePlayerField.map(c => c.instanceId === target.instanceId ? survivor : c);
            if (target.ability === 'fury') logs.push(`${target.name}'s fury activated! +1 attack`);
            logs.push(`${card.name} hit ${target.name} for ${dmg} (${survivor.currentHp} HP left)`);
          } else {
            livePlayerField = livePlayerField.filter(c => c.instanceId !== target.instanceId);
            faceDamage += overkill;
            logs.push(`${card.name} destroyed ${target.name}${overkill > 0 ? ` (${overkill} trampled)` : ''}`);
          }
          return;
        }

        // No creature blockers. A player trap springs on the attacker (and is
        // consumed); otherwise the attack hits face.
        const trap = livePlayerField.find(c => c.type === 'trap');
        if (trap) {
          const trapDamage = trap.amount || 3;
          trapDamageToOpponent += trapDamage;
          livePlayerField = livePlayerField.filter(c => c.instanceId !== trap.instanceId);
          playSound('trap');
          logs.push(`Your ${trap.name} sprang! Opponent took ${trapDamage} damage`);
        } else {
          faceDamage += card.attack;
          playSound('attack');
          logs.push(`${card.name} attacked you directly for ${card.attack} damage!`);
        }
      });

      setPlayerField(livePlayerField);
      if (faceDamage > 0) setPlayerHealth(prev => Math.max(0, prev - faceDamage));
      if (trapDamageToOpponent > 0) {
        setOpponentHealth(prev => Math.max(0, prev - trapDamageToOpponent));
        battleStatsRef.current.damageDealt += trapDamageToOpponent;
      }
      logs.forEach(addToBattleLog);

      safeTimeout(() => {
        setCurrentTurn('player');
        setTurnCount(prev => prev + 1);
        // turnCount is still the pre-increment value in this closure — use +1
        // so energy tracks the turn the player is about to take.
        setPlayerEnergy(Math.min(10, 3 + Math.floor((turnCount + 1) / 2)));
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

  // Concede the battle — counts as a loss. Guarantees the player can always
  // exit a stalled board (e.g. a hand of only buff/heal cards with an empty
  // deck) instead of being soft-locked with no damaging play available.
  const concedeGame = () => {
    if (gameOver) return;
    if (typeof window !== 'undefined' &&
        !window.confirm('Concede this battle? It will count as a loss.')) {
      return;
    }
    clearAllTimeouts(); // cancel any in-flight opponent-turn steps
    addToBattleLog('You conceded the battle.');
    setPlayerHealth(0); // routes through the existing defeat flow
  };

  // Restart game with proper state reset
  const restartGame = () => {
    // Cancel any queued opponent-turn steps from the finished game so they can't
    // fire and mutate the fresh board.
    clearAllTimeouts();

    // Reset battle stats ref
    battleStatsRef.current = { damageDealt: 0, healingDone: 0, cardsPlayed: 0 };

    // Reset game state. deckReady gates the draw phase until the init effect
    // has dealt the new opening hand.
    setDeckReady(false);
    setPhase('draw');
    setCurrentTurn('player');
    setTurnCount(1);

    // Reset player state
    setPlayerHealth(30);
    setPlayerEnergy(3);
    setPlayerMomentum(0);
    setPlayerHand([]);
    setPlayerField([]);
    setPlayerDeck([]);

    // Reset opponent state
    setOpponentHealth(30);
    setOpponentField([]);
    setOpponentDeck([]);

    // Reset UI state
    setSelectedCard(null);
    setTargetingMode(false);
    setBattleLog([]);
    setGameOver(false);
    setWinner(null);
    setShowAbilityPopup(null);
    setBattleRewards({ xp: 0, coins: 0 });

    // Increment gameId to trigger deck re-initialization useEffect
    setGameId(prev => prev + 1);
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
          <GameOverDialog
            label={winner === 'player' ? 'Victory' : 'Defeat'}
            onEscape={() => onBackToMenu && onBackToMenu()}
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

              {/* Upsell nudge — only shown when player is low on resources */}
              {(cardPacks === 0 || gems < 50) && (onOpenShop || onBackToMenu) && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.8 }}
                  className="mb-4 bg-black/30 rounded-xl p-3 text-center"
                >
                  <p className={`text-sm mb-2 ${winner === 'player' ? 'text-black/70' : 'text-white/70'}`}>
                    {cardPacks === 0 ? '📦 Out of card packs? Get more to strengthen your deck!' : '💎 Low on gems? Stock up and unlock premium cards!'}
                  </p>
                  <Button
                    size="sm"
                    onClick={onOpenShop ?? onBackToMenu}
                    className="bg-purple-600 hover:bg-purple-700 text-white text-xs"
                  >
                    Visit Shop
                  </Button>
                </motion.div>
              )}

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
          </GameOverDialog>
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
          <div className="min-w-0">
            <div className="text-white font-bold truncate max-w-[7rem] sm:max-w-none">Evil Teddies</div>
            <div className="text-red-200 text-xs whitespace-nowrap">Deck: {opponentDeck.length}</div>
          </div>
        </div>
        <div className="flex items-center space-x-2 sm:space-x-4">
          <div className="text-right">
            <div className="text-white text-sm">HP</div>
            <div className="text-white font-bold text-lg sm:text-xl whitespace-nowrap">{opponentHealth}/30</div>
          </div>
          <Progress value={(opponentHealth / 30) * 100} className="w-16 sm:w-32 h-3 bg-red-900" />
        </div>
      </div>

      {/* Opponent's field */}
      <div className="absolute top-20 left-1/2 transform -translate-x-1/2 flex justify-center space-x-3">
        {opponentField.map((card) => {
          const validTargets = getValidTargets(playerField, opponentField);
          const isValidTarget = validTargets.find(t => t.instanceId === card.instanceId);

          return (
            <motion.div
              key={card.instanceId}
              initial={{ y: -50, opacity: 0 }}
              animate={{ y: 0, opacity: card.stealthActive ? 0.5 : 1 }}
              className={`relative ${targetingMode && isValidTarget ? 'cursor-crosshair ring-2 ring-red-500 ring-offset-2' : ''}`}
              {...pressable(() => targetingMode && isValidTarget && attackTarget(card), `Attack ${card.name}`)}
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
        {targetingMode && getValidTargets(playerField, opponentField).length === 0 && (
          <motion.div
            whileHover={{ scale: 1.05 }}
            className="w-24 h-36 border-2 border-dashed border-red-400 rounded-lg flex items-center justify-center cursor-crosshair bg-red-100/50"
            {...pressable(attackOpponentDirectly, opponentField.some(c => c.type === 'trap') ? 'Strike (springs trap)' : 'Attack opponent directly')}
          >
            <span className="text-red-500 text-xs text-center">
              {opponentField.some(c => c.type === 'trap') ? 'Strike (springs trap)' : 'Attack Directly'}
            </span>
          </motion.div>
        )}
      </div>

      {/* Battle log — full panel on md+ screens; on phones it would cover the
          opponent's cards, so show only the latest entry as a compact ticker. */}
      <div className="hidden md:block absolute top-20 right-4 w-48 bg-black/60 rounded-lg p-2 max-h-40 overflow-y-auto">
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
        <div className="absolute -top-8 left-1/2 transform -translate-x-1/2 bg-amber-600 text-white px-3 sm:px-4 py-1 rounded-t-lg font-bold text-sm sm:text-base whitespace-nowrap">
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

        {/* Latest-event ticker (phones only) — the full battle-log panel is
            hidden below md because it covers the opponent's cards; the
            battlefield's top half is guaranteed empty, so surface the most
            recent entry here instead. */}
        {battleLog.length > 0 && (
          <div
            aria-live="polite"
            className="md:hidden self-center max-w-full bg-black/60 text-white text-xs px-3 py-1 rounded-full truncate pointer-events-none"
          >
            {battleLog[battleLog.length - 1].message}
          </div>
        )}

        {/* Player's field */}
        <div className="flex justify-center space-x-3 mt-auto">
          {playerField.map((card) => (
            <motion.div
              key={card.instanceId}
              whileHover={{ y: -5 }}
              className={`relative
                ${selectedCard?.instanceId === card.instanceId ? 'ring-2 ring-yellow-400' : ''}
                ${card.hasAttacked ? 'opacity-60' : 'cursor-pointer'}
              `}
              {...pressable(() => phase === 'battle' && !card.hasAttacked && selectCardForAttack(card), `Select ${card.name} to attack`)}
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

      {/* Player's hand — caps width and scrolls horizontally so a full hand
          stays reachable on phones instead of overflowing off-screen. */}
      <div className="absolute bottom-20 left-1/2 transform -translate-x-1/2 flex justify-start md:justify-center space-x-2 max-w-[96vw] overflow-x-auto px-2 pb-1">
        <AnimatePresence>
          {playerHand.map((card, index) => (
            <motion.div
              key={card.instanceId}
              initial={{ y: 50, opacity: 0 }}
              animate={{ y: 0, opacity: 1, rotate: (index - playerHand.length / 2) * 3 }}
              exit={{ y: 50, opacity: 0 }}
              whileHover={{ y: -20, scale: 1.1, zIndex: 10 }}
              className={`cursor-pointer ${playerEnergy < card.cost ? 'opacity-50' : ''}`}
              {...pressable(() => phase === 'main' && playCard(card), `Play ${card.name}`)}
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
          <div className="min-w-0">
            <div className="text-white font-bold truncate max-w-[7rem] sm:max-w-none">{playerName}</div>
            <div className="text-green-200 text-xs whitespace-nowrap">Deck: {playerDeck.length} | Hand: {playerHand.length}</div>
          </div>
        </div>
        <div className="flex items-center space-x-2 sm:space-x-4">
          <div className="flex items-center space-x-1 sm:space-x-2">
            <span className="text-yellow-300 text-lg">⚡</span>
            <span className="text-white font-bold">{playerEnergy}</span>
          </div>
          <div className="text-right">
            <div className="text-white text-sm">HP</div>
            <div className="text-white font-bold text-lg sm:text-xl whitespace-nowrap">{playerHealth}/30</div>
          </div>
          <Progress value={(playerHealth / 30) * 100} className="w-16 sm:w-32 h-3 bg-green-900" />
        </div>
      </div>

      {/* Game controls */}
      {/* On phones the old right-side stack rendered on top of the hand, so
          lay the controls out as a compact horizontal row anchored just under
          the battlefield (which ends at 2/3 viewport height) — a fixed
          bottom offset overlapped the player's field cards on short phones.
          sm+ keeps the vertical right-side stack. */}
      <div className="absolute top-[calc(66.67%+0.5rem)] inset-x-2 flex flex-row justify-center gap-2 sm:top-auto sm:inset-x-auto sm:bottom-20 sm:right-4 sm:flex-col sm:w-36">
        {targetingMode && (
          <Button
            className="flex-none h-9 px-3 text-sm sm:h-10 sm:px-4 sm:text-base sm:w-full bg-gray-500 hover:bg-gray-600 text-white"
            onClick={cancelTargeting}
          >
            Cancel
          </Button>
        )}
        {!gameOver && phase === 'main' && currentTurn === 'player' && (
          <Button
            className="flex-none h-9 px-3 text-sm sm:h-10 sm:px-4 sm:text-base sm:w-full bg-red-500 hover:bg-red-600 text-white"
            onClick={goToBattlePhase}
          >
            ⚔️ Battle
          </Button>
        )}
        {!gameOver && (phase === 'main' || phase === 'battle') && currentTurn === 'player' && (
          <Button
            className="flex-none h-9 px-3 text-sm sm:h-10 sm:px-4 sm:text-base sm:w-full bg-green-500 hover:bg-green-600 text-white"
            onClick={endTurn}
          >
            End Turn
          </Button>
        )}
        {!gameOver && currentTurn === 'player' && (
          <Button
            className="flex-none h-9 px-3 text-xs sm:h-10 sm:px-4 sm:w-full bg-white/10 hover:bg-white/20 text-white/80 text-xs border border-white/20"
            onClick={concedeGame}
          >
            🏳️ Concede
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
