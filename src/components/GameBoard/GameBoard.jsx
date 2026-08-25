import { useState, useEffect, useCallback, useRef } from 'react';
import { Button } from "@/components/ui/button";
import TeddyCard, { CardBack } from '../TeddyCard';
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/components/ui/use-toast";
import { motion, AnimatePresence } from 'framer-motion';
import { playSound as playSoundEffect } from '@/utils/sounds';
import { useGameStore, ALL_CARDS } from '../../stores/gameStore';
import confetti from 'canvas-confetti';
import { resolveCreatureHit, rallyField, effectiveCost, effectiveAttack, canAttack, readyCreatures, gainedFuryStack, getValidTargets } from '../../utils/battleUtils';
import { pickQuip, OPPONENT_NAME } from '../../utils/teddyTalk';
import { syncBattleResult, syncPlayerLevel } from '../../utils/supabaseClient';
import { chooseOpponentPlays, chooseAttackTarget, OPPONENT_ENERGY_BY_DIFFICULTY } from '../../utils/opponentAI';
import { buildOpponentDeck, OPPONENT_HEALTH_MOD_BY_DIFFICULTY } from '../../utils/opponentDeck';
import { pressable } from '@/lib/a11y';
import { useDialog } from '@/hooks/useDialog';
import { bestOwnedBorder, ownedEmotes } from '@/lib/cosmetics';

// Cap the hand so unbounded draw (per-turn + draw specials) can't overflow the
// fixed-width hand layout into an unclickable, off-screen stack.
const MAX_HAND_SIZE = 10;

// Stamp a creature's starting durability when it enters the field. `defense` is
// the HP pool in the creature-HP combat model; `currentHp` tracks the remaining
// pool as it takes hits (see resolveCreatureHit).
const withHp = (card) => ({ ...card, currentHp: card.defense });

// A full momentum gauge unlocks the Rally payoff.
const MOMENTUM_MAX = 10;

// Push the player's current level/xp to the server on the leaderboard's
// experience scale. Fire-and-forget; syncPlayerLevel no-ops when signed out.
// Reads live store state (not a hook) so it's safe to call from effects without
// threading level/xp through dependency arrays.
function syncLevelToServer() {
  const state = useGameStore.getState();
  syncPlayerLevel(state.level, state.getLeaderboardExperience())
    .catch(err => console.error('Level sync failed:', err));
}

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
 * - fury: Gains +1 attack each time it survives a hit, capped at +3 total
 * - swarm: Costs 1 less energy (min 1) once you control another creature
 * - royal: Aura — other creatures you control get +1 attack while it's on the field
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
    unlockedCosmetics,
  } = useGameStore();

  // Battle Pass cosmetics: premium card frames on the player's own cards (never
  // Chuck's), and unlocked table emotes. Pure derivations, cheap per render.
  const cosmeticBorder = bestOwnedBorder(unlockedCosmetics);
  const emotes = ownedEmotes(unlockedCosmetics);

  // Accumulate per-game stats for challenge/achievement tracking
  // damageTaken is what the 'Flawless' achievement actually means. Final HP
  // can't answer it: heal is capped at 30, so a player who gets hit and then
  // heals back finishes at full and would have claimed "Win without losing HP".
  const battleStatsRef = useRef({ damageDealt: 0, healingDone: 0, cardsPlayed: 0, damageTaken: 0 });

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
  // Chuck's starting HP is difficulty-scaled (hard adds +5), so the bar's
  // denominator has to travel with it. Hardcoding 30 made hard render "35/30"
  // at 117% — and Radix rejects a value above max by logging an error AND
  // falling back to null, which silently drops the aria-valuenow the
  // accessibility pass added and reports the bar as indeterminate.
  const [opponentMaxHealth, setOpponentMaxHealth] = useState(30);
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

  // Chuck's trash talk: a transient speech bubble ({id, text}) plus his parting
  // shot on the game-over screen. Decorative flavor — aria-hidden, the battle
  // log stays the accessible record.
  const [oppQuip, setOppQuip] = useState(null);
  const [endQuip, setEndQuip] = useState(null);
  const quipIdRef = useRef(0);
  const lastQuipRef = useRef(null);
  const nearDeathQuippedRef = useRef(false);

  // Snapshot of the in-progress state for the unmount handler below — a cleanup
  // closes over its mount-time values, so it must read the latest through a ref.
  const liveRef = useRef({ gameOver, deckReady, playerHealth });
  liveRef.current = { gameOver, deckReady, playerHealth };

  // Leaving a battle mid-game counts as a loss. The "← Menu" control lives in
  // App, outside this component, so abandoning simply unmounts the board — with
  // no result recorded, a player could bail out of a losing game and keep their
  // win streak intact. Record the loss on unmount, but only for a battle that
  // was actually joined (deckReady) and isn't already resolved (gameOver) — a
  // finished game recorded its own result, and the `deckReady` gate also makes
  // this inert under React 18 StrictMode's mount→unmount→remount in dev, where
  // the opening hand hasn't been dealt yet at the throwaway cleanup.
  const abandonHandledRef = useRef(false);
  // The xp/coins the abandonment loss actually granted, so a bfcache-restored
  // defeat screen can show real figures instead of zeros.
  const abandonRewardsRef = useRef(null);
  useEffect(() => {
    // Empty deps + reading the action through getState() means this effect never
    // re-runs, so it only tears down on a genuine unmount — never mid-battle
    // because a dependency changed.
    const recordAbandonment = () => {
      const { gameOver: over, deckReady: ready, playerHealth: hp } = liveRef.current;
      if (over || !ready || abandonHandledRef.current) return;
      abandonHandledRef.current = true;
      const stats = battleStatsRef.current;
      // The local record persists synchronously through the store — that is what
      // closes the streak exploit even mid-unload. The server syncs are best-effort.
      abandonRewardsRef.current = useGameStore.getState()
        .recordBattleResult(false, stats.damageDealt, stats.healingDone, hp, stats.cardsPlayed);
      syncBattleResult(false, stats.damageDealt, stats.healingDone, 5)
        .catch(err => console.error('Abandon sync failed:', err));
      syncLevelToServer();
    };
    // Back/forward-cache restore. pagehide fires when the page ENTERS bfcache
    // too (pagehide listeners never block caching), so the loss above is
    // recorded — and then the browser can restore this exact component state,
    // mid-battle, gameOver still false. Without reconciliation, finishing that
    // restored battle would book a SECOND result for the same game (the
    // game-over effect checks only health). Settle the restored battle as the
    // defeat that was already recorded: setGameOver(true) makes the game-over
    // effect a permanent no-op (it early-returns on gameOver), so one battle
    // can never record twice.
    const onPageShow = (e) => {
      if (!e.persisted || !abandonHandledRef.current) return;
      if (liveRef.current.gameOver) return;
      clearAllTimeouts();
      setOppQuip(null);
      setPlayerQuip(null);
      setEndQuip(pickQuip('oppWins'));
      if (abandonRewardsRef.current) {
        setBattleRewards({ xp: abandonRewardsRef.current.xpGain, coins: abandonRewardsRef.current.coinsGain });
      }
      setWinner('opponent');
      setGameOver(true);
    };
    // pagehide covers reload / tab-close / cross-document navigation — the cases
    // where React effect cleanups do NOT run, so the unmount path alone would
    // miss them and a losing game could be dropped (F5) with the streak intact.
    // Battle state is component-local, not persisted, so nothing else records it.
    window.addEventListener('pagehide', recordAbandonment);
    window.addEventListener('pageshow', onPageShow);
    // Unmount — e.g. the "← Menu" SPA button, which does NOT fire pagehide.
    // abandonHandledRef makes the two paths mutually idempotent.
    return () => {
      window.removeEventListener('pagehide', recordAbandonment);
      window.removeEventListener('pageshow', onPageShow);
      recordAbandonment();
    };
    // clearAllTimeouts is a stable [] useCallback, so this still runs once.
  }, [clearAllTimeouts]);

  // Player-side emote bubble (Battle Pass emote cosmetics). Mirrors Chuck's
  // quip bubble: decorative and aria-hidden, with the battle log carrying the
  // accessible record of every emote.
  const [playerQuip, setPlayerQuip] = useState(null);
  const playerQuipIdRef = useRef(0);
  const lastEmoteAtRef = useRef(0);
  const sendEmote = (emote) => {
    // Small cooldown so mashing the button can't spam confetti/bubbles.
    const now = Date.now();
    if (now - lastEmoteAtRef.current < 2500) return;
    lastEmoteAtRef.current = now;

    if (emote.effect === 'confetti') {
      confetti({ particleCount: 90, spread: 75, origin: { y: 0.75 } });
      addToBattleLog('🎉 You fire the confetti cannon. Chuck is unimpressed but covered in glitter.');
      return;
    }
    const text = pickQuip('playerEmote', playerQuip?.text ?? null);
    if (!text) return;
    const id = ++playerQuipIdRef.current;
    setPlayerQuip({ id, text });
    addToBattleLog(`🎭 You: "${text}"`);
    safeTimeout(() => {
      setPlayerQuip((q) => (q && q.id === id ? null : q));
    }, 3500);
  };

  const speak = useCallback((pool) => {
    const text = pickQuip(pool, lastQuipRef.current);
    if (!text) return;
    lastQuipRef.current = text;
    const id = ++quipIdRef.current;
    setOppQuip({ id, text });
    // Dismiss via the tracked-timeout system so restart/concede/unmount cancel
    // it; only clear if a newer quip hasn't already replaced this one.
    safeTimeout(() => {
      setOppQuip((q) => (q && q.id === id ? null : q));
    }, 3200);
  }, [safeTimeout]);

  const { toast } = useToast();

  // Play sound helper
  const playSound = useCallback((soundName) => {
    playSoundEffect(soundName, storeSoundEnabled);
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

    // Fallback if no deck is set — the starter ten, resolved from ALL_CARDS
    // by name so ids, stats, rarities (and shipped card art) stay canonical.
    const starterNames = [
      "Shitstarter Ted", "Shit-Talk Sally", "Honey Trap", "Emergency Fluff Job",
      "Shiv-in-a-Pillow", "Chokehold Cuddles", "Peeping Pete", "Honey on the Rocks",
      "The F-Bomb", "Restraining-Order Randy",
    ];
    const deckToUse = playerDeckCards.length >= 5
      ? playerDeckCards
      : starterNames
          .map(name => ALL_CARDS.find(c => c.name === name))
          .filter(Boolean)
          .map((card, idx) => ({ ...card, instanceId: `p-${card.id}-${idx}` }));

    const initialPlayerDeck = shuffleDeck(deckToUse);

    // Generate opponent deck based on difficulty — a fresh crew every fight,
    // scaled by difficulty (see opponentDeck.js), instead of the same 8 goons
    // forever.
    const { cards: opponentCards, crewName } = buildOpponentDeck(aiDifficulty);
    const healthMod = OPPONENT_HEALTH_MOD_BY_DIFFICULTY[aiDifficulty] ?? 0;

    const initialOpponentDeck = shuffleDeck(opponentCards);

    // Set opponent health based on difficulty
    setOpponentHealth(30 + healthMod);
    setOpponentMaxHealth(30 + healthMod);

    const playerInitialHand = initialPlayerDeck.slice(0, 5);
    const playerRemainingDeck = initialPlayerDeck.slice(5);

    setPlayerHand(playerInitialHand);
    setPlayerDeck(playerRemainingDeck);

    // Chuck's opener is summoning-sick too, so neither side swings on its
    // first turn. Without this the rule is lopsided: the player's turn-1 play
    // has to sit still while the opener — placed before the game even starts —
    // hits it for free, handing Chuck first blood every single game.
    setOpponentField([{ ...withHp(initialOpponentDeck[0]), summoningSick: true }]);
    setOpponentDeck(initialOpponentDeck.slice(1));

    addToBattleLog(`${OPPONENT_NAME} slams his deck on the table with ${crewName} at his back. Difficulty: ${aiDifficulty.toUpperCase()}`);
    addToBattleLog("Your turn. Make it hurt.");
    setDeckReady(true);
    speak('gameStart');
  }, [addToBattleLog, currentDeck, aiDifficulty, gameId, speak]);

  // Check for game over. Opponent death is checked first so that a simultaneous
  // lethal (both reach 0 in the same commit) counts as a win for the player who
  // dealt it, rather than an unconditional loss.
  useEffect(() => {
    if (gameOver) return;
    if (opponentHealth <= 0) {
      clearAllTimeouts(); // cancel any queued opponent-turn steps
      setGameOver(true);
      setWinner('player');
      setOppQuip(null);
      setPlayerQuip(null); // its dismiss timer was just cancelled by clearAllTimeouts
      setEndQuip(pickQuip('oppLoses'));
      playSound('victory');

      // Record victory — store handles XP and coin rewards
      const { xpGain, coinsGain } = recordBattleResult(
        true,
        battleStatsRef.current.damageDealt,
        battleStatsRef.current.healingDone,
        playerHealth,
        battleStatsRef.current.cardsPlayed,
        battleStatsRef.current.damageTaken
      );
      setBattleRewards({ xp: xpGain, coins: coinsGain });

      // Sync to server (fire and forget - don't block UI)
      syncBattleResult(true, battleStatsRef.current.damageDealt, battleStatsRef.current.healingDone, coinsGain)
        .catch(err => console.error('Battle sync failed:', err));
      // recordBattleResult ran addXP synchronously, so the store level/xp are
      // now current. Push them so the leaderboard's rival rows stop reading as
      // Level 1 (players.experience is otherwise never written).
      syncLevelToServer();

      // Victory confetti
      confetti({
        particleCount: 150,
        spread: 100,
        origin: { y: 0.6 },
        colors: ['#fbbf24', '#f59e0b', '#fde68a', '#a855f7', '#38bdf8'],
      });

      toast({
        title: "Victory!",
        description: `${OPPONENT_NAME} has been thoroughly unstuffed.`,
      });
    } else if (playerHealth <= 0) {
      clearAllTimeouts(); // cancel any queued opponent-turn steps
      setGameOver(true);
      setWinner('opponent');
      setOppQuip(null);
      setPlayerQuip(null); // its dismiss timer was just cancelled by clearAllTimeouts
      setEndQuip(pickQuip('oppWins'));
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
      // Keep the server level/xp current even on a loss (a loss still grants XP).
      syncLevelToServer();

      toast({
        title: "Defeat!",
        description: "Your squad got the stuffing beaten out of them.",
        variant: "destructive",
      });
    }
  }, [playerHealth, opponentHealth, gameOver, toast, playSound, recordBattleResult, aiDifficulty, clearAllTimeouts]);

  // Chuck starts sweating when he's nearly unstuffed — once per game.
  useEffect(() => {
    if (gameOver) return;
    if (opponentHealth > 0 && opponentHealth <= 8 && !nearDeathQuippedRef.current) {
      nearDeathQuippedRef.current = true;
      speak('oppNearDeath');
    }
  }, [opponentHealth, gameOver, speak]);

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
  // getValidTargets now lives in battleUtils (pure, and unit-tested for the
  // taunt > protect > all precedence — see battleUtils.test.js). Imported at
  // the top; both call sites here pass (attackerField, defenderField) as before.

  // Play a card from hand
  const playCard = (card) => {
    if (currentTurn !== 'player' || phase !== 'main') return;

    // A 'swarm' card is 1 energy cheaper (min 1) once another creature is
    // already on the field — see effectiveCost. Use this for both the
    // affordability check and the deduction below so the rule and the UI
    // (and the "not enough energy" message) always agree.
    const cost = effectiveCost(card, playerField);

    if (playerEnergy < cost) {
      toast({
        title: "Not enough energy!",
        description: `${card.name} costs ${cost} energy`,
        variant: "destructive",
      });
      return;
    }

    // Handle special cards
    if (card.type === 'special') {
      applySpecialEffect(card);
      setPlayerEnergy(prev => prev - cost);
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

    // Stamp starting HP; apply stealth on play. Creatures also enter
    // summoning-sick, so they cannot swing until the player's next turn (see
    // canAttack in battleUtils) — traps never attack, so they carry no flag.
    const cardToPlay = {
      ...withHp(card),
      ...(card.type === 'action' ? { summoningSick: true } : {}),
      ...(card.ability === 'stealth' ? { stealthActive: true } : {}),
    };

    setPlayerField(prev => [...prev, cardToPlay]);
    setPlayerHand(prev => prev.filter(c => c.instanceId !== card.instanceId));
    setPlayerEnergy(prev => prev - cost);
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
      case 'heal': {
        // Credit the healing that actually landed, not the card's face value.
        // Healing caps at 30, so playing a +10 heal at 28 HP restores 2 — but
        // the full 10 was being counted toward the 'Medic Bear' achievement and
        // the daily healing challenge, letting both be farmed at full HP.
        const healed = Math.min(30, playerHealth + card.amount) - playerHealth;
        setPlayerHealth(prev => Math.min(30, prev + card.amount));
        battleStatsRef.current.healingDone += healed;
        playSound('heal');
        addToBattleLog(`${card.name}: +${healed} HP. No questions asked.`);
        toast({ title: "Patched Up!", description: `+${healed} HP. The stuffing guy owed you a favor.` });
        break;
      }
      case 'draw': {
        // The card being played is still in playerHand here — playCard calls
        // applySpecialEffect BEFORE filtering it out — so the hand cap has to
        // account for the slot it is about to free. Without the -1 a 9-card
        // hand playing "draw 2" only drew 1 and finished at 9 instead of 10.
        const handAfterPlay = Math.max(0, playerHand.length - 1);
        const cardsToDraw = Math.min(card.amount, playerDeck.length, Math.max(0, MAX_HAND_SIZE - handAfterPlay));
        const drawnCards = playerDeck.slice(0, cardsToDraw);
        setPlayerHand(prev => [...prev, ...drawnCards]);
        setPlayerDeck(prev => prev.slice(cardsToDraw));
        playSound('draw');
        addToBattleLog(`${card.name}: drew ${cardsToDraw} — the dealer likes you`);
        toast({ title: "Hit Me!", description: `Drew ${cardsToDraw}. The house always wins — congrats, you are the house.` });
        break;
      }
      case 'buff':
        setPlayerField(prev => prev.map(c => ({ ...c, attack: c.attack + card.amount })));
        addToBattleLog(`Your whole squad is FIRED UP — +${card.amount} attack across the board!`);
        toast({ title: 'Juiced!', description: `Everybody +${card.amount} attack. Totally natural. Don't test them.` });
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
    if (card.summoningSick) {
      toast({
        title: "Still finding the floor",
        description: `${card.name} only just staggered in — it can swing from your next turn.`,
        variant: "destructive",
      });
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

    // Re-read the attacker from the live field instead of trusting the
    // selection snapshot. selectedCard is captured when targeting opens, but
    // the board can change while targeting is still up — Rally is the reachable
    // case: it replaces every field card with a +1-attack, fully-restuffed copy,
    // so attacking after rallying mid-targeting resolved with the stale
    // pre-Rally attack and silently ate the buff the player just spent a full
    // momentum gauge on.
    const attacker = playerField.find(c => c.instanceId === selectedCard.instanceId) || selectedCard;

    // Resolve against the target's HP: it survives a non-lethal hit (and its
    // fury fires), or dies and trample overkill spills to the opponent's face.
    // Pass playerField so a 'royal' ally on the attacker's side buffs the hit.
    const { survivor, overkill, dmg } = resolveCreatureHit(attacker, target, playerField);
    playSound('attack');
    battleStatsRef.current.damageDealt += dmg;

    if (survivor) {
      setOpponentField(prev => prev.map(c => c.instanceId === target.instanceId ? survivor : c));
      if (target.ability === 'fury') {
        addToBattleLog(gainedFuryStack(target, survivor)
          ? `${target.name}'s fury activated! +1 attack`
          : `${target.name} is already as furious as they get — capped at +3.`);
      }
      addToBattleLog(`${attacker.name} smacked ${target.name} for ${dmg} (${survivor.currentHp} HP left)`);
      toast({ title: "Hit!", description: `${target.name} is hanging on at ${survivor.currentHp} HP.` });
    } else {
      setOpponentField(prev => prev.filter(c => c.instanceId !== target.instanceId));
      if (overkill > 0) setOpponentHealth(prev => Math.max(0, prev - overkill));
      addToBattleLog(`UNSTUFFED! ${attacker.name} took ${target.name} apart${overkill > 0 ? ` — ${overkill} trampled right into ${OPPONENT_NAME}'s beans` : ''}`);
      toast({ title: "UNSTUFFED!", description: `${target.name} is fluff on the floor${overkill > 0 ? ` — ${overkill} tramples through!` : '.'}` });
      speak('oppLosesCreature');
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
        title: "Blocked!",
        description: `${OPPONENT_NAME}'s goons are in the way. Deal with them first.`,
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
      battleStatsRef.current.damageTaken += trapDamage;
      setOpponentField(prev => prev.filter(c => c.instanceId !== trap.instanceId));
      playSound('trap');
      addToBattleLog(`${trap.name} sprang! ${trapDamage} damage, right in your pride`);
      toast({ title: "It's a Trap!", description: `${trap.name} got you for ${trapDamage}. ${OPPONENT_NAME} is giggling.`, variant: "destructive" });
    } else {
      // Re-read the attacker from the live field, not the selection snapshot:
      // Rally mid-targeting replaces every field card with a +1-attack copy, so
      // computing from selectedCard would deal the pre-Rally value straight to
      // face — the same stale-snapshot bug already fixed in attackTarget.
      // effectiveAttack then folds in any 'royal' ally aura on top.
      const attacker = playerField.find(c => c.instanceId === selectedCard.instanceId) || selectedCard;
      const faceDamage = effectiveAttack(attacker, playerField);
      playSound('attack');
      setOpponentHealth(prev => Math.max(0, prev - faceDamage));
      battleStatsRef.current.damageDealt += faceDamage;
      addToBattleLog(`${attacker.name} decked ${OPPONENT_NAME} in the face for ${faceDamage}!`);
      toast({ title: "Right in the Face!", description: `${faceDamage} damage straight to ${OPPONENT_NAME}'s smug mug.` });
      if (faceDamage >= 4) speak('oppTakesFaceHit');
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
    addToBattleLog("Battle phase. Gloves off, paws up.");
  };

  // End turn
  const endTurn = () => {
    // Guard like every sibling handler: only the player, on their own turn, ends
    // it — so a stray call during the opponent's turn can't queue a second
    // executeOpponentTurn.
    if (currentTurn !== 'player') return;
    setPlayerField(prev => readyCreatures(prev));
    setSelectedCard(null);
    setTargetingMode(false);
    setCurrentTurn('opponent');
    setPhase('end');
    addToBattleLog("Ending turn...");
    safeTimeout(executeOpponentTurn, 1000);
  };

  // Momentum payoff: at a full gauge, spend it all to rally the board — every
  // teddy gets +1 attack and heals to full HP (the only way to heal wounded
  // creatures under the HP model). Usable any time on the player's turn.
  const rally = () => {
    if (currentTurn !== 'player' || gameOver || playerMomentum < MOMENTUM_MAX) return;
    setPlayerField(prev => rallyField(prev));
    setPlayerMomentum(0);
    playSound('heal');
    confetti({
      particleCount: 120, spread: 90, origin: { y: 0.7 },
      colors: ['#fbbf24', '#f59e0b', '#f97316', '#fde68a'],
    });
    addToBattleLog('⚡ RALLY! Your teddies scream something unprintable — +1 attack, fully restuffed!');
    toast({ title: '⚡ Rally!', description: 'Your squad is juiced, restuffed, and legally a mob now.' });
    speak('playerRally');
  };

  // Opponent AI turn
  const executeOpponentTurn = () => {
    addToBattleLog(`${OPPONENT_NAME}'s turn. Brace your beans.`);

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
    // Pass activeOpponentField so a 'swarm' card in the opponent's hand is
    // budgeted at its discounted cost under the same rule the player follows.
    const { plays, remainingDeck } = chooseOpponentPlays(opponentDeck, opponentField.length, energyBudget, 3, activeOpponentField);
    // Creatures the opponent plays THIS turn. They can't attack (summoning-sick),
    // but a 'royal' among them must still project its aura to the opponent's
    // other attackers this turn — mirroring the player, whose just-played royal
    // buffs immediately. The attack loop reads this for aura only.
    let playedThisTurn = [];
    if (plays.length > 0) {
      setOpponentDeck(remainingDeck);
      const played = plays.map(c => ({
        ...withHp(c),
        summoningSick: true,
        ...(c.ability === 'stealth' ? { stealthActive: true } : {}),
      }));
      playedThisTurn = played;
      setOpponentField(prev => [...prev, ...played]);
      playSound('cardPlay');
      plays.forEach(c => addToBattleLog(`${OPPONENT_NAME} slammed down ${c.name}`));
      speak('oppPlays');
    }

    // Opponent attacks — resolve against a live working copy so each attacker
    // re-evaluates targets (taunt/protect) as creatures fall, instead of every
    // attacker piling onto a single stale target and the rest no-opping.
    safeTimeout(() => {
      // Ready the working copy: endTurn already cleared these flags in state,
      // but this closure predates that render, and the unconditional write-back
      // below would otherwise restore them — bricking any attacker that
      // survives an opponent turn as permanently Exhausted, and any creature
      // played last turn as permanently summoning-sick.
      let livePlayerField = readyCreatures(playerField);
      let faceDamage = 0;
      let trapDamageToOpponent = 0;
      let killedPlayerCreature = false;
      const logs = [];

      // Aura field for royal: the pre-existing board PLUS what was just played,
      // so a royal the opponent dropped this turn buffs its other attackers.
      // Attackers still come only from activeOpponentField (played cards are
      // summoning-sick and filtered by canAttack).
      const auraField = [...activeOpponentField, ...playedThisTurn];

      activeOpponentField.forEach(card => {
        if (!canAttack(card)) return; // summoning-sick, spent, or not a creature

        // Creature blockers (taunt/protect/normal) must be dealt with first.
        const targets = getValidTargets(opponentField, livePlayerField);

        if (targets.length > 0) {
          // Attack the biggest threat; resolve against its HP just like the
          // player's attackTarget — it survives (fury fires) or dies with trample
          // overkill carrying through to the player's face.
          const target = chooseAttackTarget(targets, card);
          // Pass auraField so a 'royal' ally on the opponent's own field —
          // including one it just played this turn — buffs this attacker's hit,
          // same as the player's attackTarget.
          const { survivor, overkill, dmg } = resolveCreatureHit(card, target, auraField);
          playSound('attack');
          if (survivor) {
            livePlayerField = livePlayerField.map(c => c.instanceId === target.instanceId ? survivor : c);
            if (target.ability === 'fury') {
              logs.push(gainedFuryStack(target, survivor)
                ? `${target.name} is FURIOUS now! +1 attack`
                : `${target.name} is capped out at +3 fury — poke away.`);
            }
            logs.push(`${card.name} roughed up ${target.name} for ${dmg} (${survivor.currentHp} HP left)`);
          } else {
            livePlayerField = livePlayerField.filter(c => c.instanceId !== target.instanceId);
            faceDamage += overkill;
            killedPlayerCreature = true;
            logs.push(`${card.name} UNSTUFFED ${target.name}${overkill > 0 ? ` — ${overkill} trampled into your beans` : ''}`);
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
          logs.push(`Your ${trap.name} sprang! ${OPPONENT_NAME} ate ${trapDamage} damage. Delicious.`);
        } else {
          // Include a 'royal' ally's aura in the opponent's face damage too, not
          // just its creature-vs-creature hits. Uses auraField so a royal played
          // this turn counts. Mirrors the player-side fix at attackOpponentDirectly.
          const oppFaceDamage = effectiveAttack(card, auraField);
          faceDamage += oppFaceDamage;
          playSound('attack');
          logs.push(`${card.name} socked you right in the face for ${oppFaceDamage}!`);
        }
      });

      setPlayerField(livePlayerField);
      // Chuck's board has now sat through a full round, so everything on it —
      // the opener, and whatever he just slammed down — is settled and free to
      // swing next turn. Done after the wave rather than before it so cards
      // played this turn still sit out the turn they arrived.
      setOpponentField(prev => readyCreatures(prev));
      if (faceDamage > 0) {
        setPlayerHealth(prev => Math.max(0, prev - faceDamage));
        battleStatsRef.current.damageTaken += faceDamage;
      }
      if (trapDamageToOpponent > 0) {
        setOpponentHealth(prev => Math.max(0, prev - trapDamageToOpponent));
        battleStatsRef.current.damageDealt += trapDamageToOpponent;
      }
      logs.forEach(addToBattleLog);
      // One gloat per attack wave, best material first: a kill outranks a jab.
      if (killedPlayerCreature) speak('oppKills');
      else if (faceDamage > 0) speak('oppHitsFace');

      safeTimeout(() => {
        setCurrentTurn('player');
        setTurnCount(prev => prev + 1);
        // turnCount is still the pre-increment value in this closure — use +1
        // so energy tracks the turn the player is about to take.
        setPlayerEnergy(Math.min(10, 3 + Math.floor((turnCount + 1) / 2)));
        setPhase('draw');
        addToBattleLog("Your turn. Get him.");
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
        !window.confirm(`Concede this battle? It counts as a loss, and ${OPPONENT_NAME} will NEVER let you hear the end of it.`)) {
      return;
    }
    clearAllTimeouts(); // cancel any in-flight opponent-turn steps
    addToBattleLog(`You conceded. ${OPPONENT_NAME} is doing a little dance.`);
    setPlayerHealth(0); // routes through the existing defeat flow
  };

  // Restart game with proper state reset
  const restartGame = () => {
    // Cancel any queued opponent-turn steps from the finished game so they can't
    // fire and mutate the fresh board.
    clearAllTimeouts();

    // Reset battle stats ref
    battleStatsRef.current = { damageDealt: 0, healingDone: 0, cardsPlayed: 0, damageTaken: 0 };

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

    // Reset opponent state (initializeGame re-applies the difficulty mod to
    // both of these when the fresh game deals).
    setOpponentHealth(30);
    setOpponentMaxHealth(30);
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

    // Reset both mouths
    setOppQuip(null);
    setPlayerQuip(null);
    setEndQuip(null);
    lastQuipRef.current = null;
    nearDeathQuippedRef.current = false;

    // Re-arm abandonment tracking: after a bfcache-settled defeat, Play Again
    // keeps this component mounted, so the latch must reset or the NEW
    // battle's abandonment would silently never record.
    abandonHandledRef.current = false;
    abandonRewardsRef.current = null;

    // Increment gameId to trigger deck re-initialization useEffect
    setGameId(prev => prev + 1);
  };

  // Get ability description
  const getAbilityDescription = (ability) => {
    const descriptions = {
      taunt: "Forces enemies to attack this card first",
      piercing: "Cuts through Shield (defense here is HP, and piercing does not skip it)",
      shield: "Takes 50% less damage",
      stealth: "Can't be targeted for one turn",
      protect: "Other cards can't be targeted",
      fury: "Gains +1 attack when damaged (up to +3)",
      swarm: "Costs 1 less energy (min 1) if you already control another creature",
      royal: "Other creatures you control get +1 attack while this is on the field",
    };
    return descriptions[ability] || "";
  };

  // Game-over styling: a win gets the brass trophy panel (dark ink text), a
  // loss gets the night back-of-the-bar panel (light text). One object instead
  // of a ternary per element.
  const go = winner === 'player'
    ? {
        panel: 'bg-gradient-to-b from-brass-400 to-brass-600',
        title: 'text-night-950',
        body: 'text-night-950/70',
        quip: 'text-night-950/60',
        box: 'bg-night-950/20',
        boxTitle: 'text-night-950',
        reward: 'text-night-950',
        again: 'bg-night-950 text-plush-100 hover:bg-night-900',
        menu: 'border-night-950 text-night-950 hover:bg-night-950/10',
      }
    : {
        panel: 'bg-gradient-to-b from-night-700 to-night-900',
        title: 'text-plush-100',
        body: 'text-plush-100/70',
        quip: 'text-plush-100/60',
        box: 'bg-white/10',
        boxTitle: 'text-plush-100',
        reward: 'text-brass-300',
        again: 'bg-brass-500 hover:bg-brass-600 text-night-950',
        menu: 'border-plush-300 text-plush-100 hover:bg-white/10',
      };

  return (
    <div className="relative w-full h-screen bg-gradient-to-b from-night-900 to-night-950 worn overflow-hidden">
      {/* Ability Popup */}
      <AnimatePresence>
        {showAbilityPopup && (
          <motion.div
            initial={{ opacity: 0, y: -50, scale: 0.5 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.5 }}
            className="absolute top-1/3 left-1/2 transform -translate-x-1/2 z-50 bg-night-700 border-2 border-brass-400/60 text-plush-100 px-6 py-3 rounded-lg shadow-lg shadow-black/50"
          >
            <div className="text-lg font-bold">{showAbilityPopup.name}</div>
            <div className="text-sm text-plush-300">{getAbilityDescription(showAbilityPopup.ability)}</div>
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
              className={`relative rounded-2xl p-8 text-center max-w-md w-full mx-4 worn ${go.panel}`}
            >
              <motion.div
                animate={{ scale: [1, 1.2, 1], rotate: [0, 10, -10, 0] }}
                transition={{ duration: 0.5 }}
                className="text-6xl mb-4"
              >
                {winner === 'player' ? '🏆' : '💔'}
              </motion.div>
              <h2 className={`text-4xl font-display font-bold mb-2 ${go.title}`}>
                {winner === 'player' ? 'TOTAL FLUFFING VICTORY!' : 'ABSOLUTELY UNSTUFFED!'}
              </h2>
              <p className={`mb-2 ${go.body}`}>
                {winner === 'player'
                  ? `${OPPONENT_NAME} rage-quit into the toy chest.`
                  : `${OPPONENT_NAME} is doing a victory lap. It's insufferable.`}
              </p>
              {endQuip && (
                <p className={`mb-6 text-sm italic ${go.quip}`}>
                  🧸 {OPPONENT_NAME}: “{endQuip}”
                </p>
              )}

              {/* Rewards */}
              <div className={`rounded-xl p-4 mb-6 ${go.box}`}>
                <div className={`text-sm font-semibold mb-3 ${go.boxTitle}`}>
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
                    <div className={`font-bold ${go.reward}`}>
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
                    <div className={`font-bold ${go.reward}`}>
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
                  <p className={`text-sm mb-2 ${go.body}`}>
                    {cardPacks === 0 ? '📦 Out of packs? Your squad isn\u2019t going to recruit itself.' : '💎 Low on gems? Chuck says being broke is a personality flaw.'}
                  </p>
                  <Button
                    size="sm"
                    onClick={onOpenShop ?? onBackToMenu}
                    className="bg-night-800 hover:bg-night-700 text-plush-100 text-xs"
                  >
                    Visit Shop
                  </Button>
                </motion.div>
              )}

              <div className="flex gap-3 justify-center">
                <Button
                  onClick={restartGame}
                  className={go.again}
                >
                  Play Again
                </Button>
                {onBackToMenu && (
                  <Button
                    onClick={onBackToMenu}
                    variant="outline"
                    className={go.menu}
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
        className="absolute top-20 left-4 z-40 bg-night-800/80 border border-plush-700/40 p-2 rounded-full shadow"
        title={storeSoundEnabled ? "Sound on" : "Sound off"}
      >
        {storeSoundEnabled ? '🔊' : '🔇'}
      </div>

      {/* Chuck's trash talk — decorative speech bubble; the battle log is the
          accessible record, so this is hidden from assistive tech. */}
      <AnimatePresence>
        {oppQuip && (
          <motion.div
            key={oppQuip.id}
            aria-hidden="true"
            initial={{ opacity: 0, y: -8, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ type: 'spring', stiffness: 350, damping: 22 }}
            className="absolute top-[8.5rem] left-4 z-30 max-w-[230px] pointer-events-none"
          >
            <div className="relative bg-plush-100/95 text-night-900 text-sm font-semibold rounded-2xl rounded-tl-sm px-3 py-2 shadow-lg border border-brass-400/60">
              <span className="mr-1">🧸</span>
              {oppQuip.text}
              <div className="absolute -top-2 left-3 w-0 h-0 border-l-8 border-l-transparent border-r-8 border-r-transparent border-b-8 border-b-plush-100/95" />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* The player's emote bubble (Teddy Emote cosmetic) — same decorative
          treatment as Chuck's; the battle log carries the accessible record. */}
      <AnimatePresence>
        {playerQuip && (
          <motion.div
            key={playerQuip.id}
            aria-hidden="true"
            initial={{ opacity: 0, y: 8, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ type: 'spring', stiffness: 350, damping: 22 }}
            className="absolute bottom-[9.5rem] right-4 z-30 max-w-[230px] pointer-events-none"
          >
            <div className="relative bg-brass-100/95 text-night-900 text-sm font-semibold rounded-2xl rounded-br-sm px-3 py-2 shadow-lg border border-brass-400/60">
              <span className="mr-1">🎭</span>
              {playerQuip.text}
              <div className="absolute -bottom-2 right-3 w-0 h-0 border-l-8 border-l-transparent border-r-8 border-r-transparent border-t-8 border-t-brass-100/95" />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Top bar - Opponent info */}
      <div className="absolute top-0 left-0 right-0 h-16 bg-gradient-to-r from-red-950 to-red-900 flex items-center justify-between pl-28 pr-4 shadow-lg">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-red-800 rounded-full border-2 border-red-300 flex items-center justify-center">
            <span className="text-white text-xl">🧸</span>
          </div>
          <div className="min-w-0">
            <div className="text-white font-bold truncate max-w-[7rem] sm:max-w-none">{OPPONENT_NAME}</div>
            <div className="text-red-200 text-xs whitespace-nowrap">Deck: {opponentDeck.length}</div>
          </div>
          {/* Opponent's draw pile, face down on the table */}
          {opponentDeck.length > 0 && (
            <div className="relative w-8 h-11 shrink-0 hidden sm:block" aria-hidden="true">
              <div className="absolute inset-0 rotate-6"><CardBack className="w-8 h-11" mini /></div>
              <div className="absolute inset-0 -rotate-3"><CardBack className="w-8 h-11" mini /></div>
              <CardBack className="w-8 h-11" mini />
            </div>
          )}
        </div>
        <div className="flex items-center space-x-2 sm:space-x-4">
          <div className="text-right">
            <div className="text-white text-sm">HP</div>
            {/* key-remount replays the pop on every HP change, so each hit reads. */}
            <motion.div
              key={opponentHealth}
              initial={{ scale: 1.6, color: '#fca5a5' }}
              animate={{ scale: 1, color: '#ece6f2' }}
              transition={{ type: 'spring', stiffness: 400, damping: 14 }}
              className="font-bold text-lg sm:text-xl whitespace-nowrap"
            >
              {opponentHealth}/{opponentMaxHealth}
            </motion.div>
          </div>
          <Progress
            value={(opponentHealth / opponentMaxHealth) * 100}
            className="w-16 sm:w-32 h-3 bg-red-950 [&>div]:bg-red-400"
            aria-label={`${OPPONENT_NAME} health: ${opponentHealth} of ${opponentMaxHealth}`}
          />
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
              {/* Tells the player which of Chuck's teddies can actually swing
                  at them next turn — without it, summoning sickness is only
                  legible on their own half of the table. */}
              {card.summoningSick && (
                <div className="text-center text-xs text-plush-300 mt-1">Warming Up</div>
              )}
              {card.stealthActive && (
                <div className="absolute top-[20px] left-0 right-0 bg-purple-500/90 text-white text-[8px] text-center z-10">
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
            className="w-24 h-36 border-2 border-dashed border-red-500 rounded-lg flex items-center justify-center cursor-crosshair bg-red-950/40"
            {...pressable(attackOpponentDirectly, opponentField.some(c => c.type === 'trap') ? 'Strike (springs trap)' : 'Attack opponent directly')}
          >
            <span className="text-red-300 text-xs text-center">
              {opponentField.some(c => c.type === 'trap') ? 'Strike (springs trap)' : 'Attack Directly'}
            </span>
          </motion.div>
        )}
      </div>

      {/* Battle log — full panel on md+ screens; on phones it would cover the
          opponent's cards, so show only the latest entry as a compact ticker.
          tabIndex + role/aria-label make the scrolling panel keyboard-
          reachable (axe: scrollable-region-focusable) so it can be read on
          demand. It intentionally has no aria-live: the phone ticker below
          already announces each new entry, and this panel repeating that
          would double-announce for screen-reader users on md+ too. */}
      <div
        role="region"
        aria-label="Battle log"
        tabIndex={0}
        className="hidden md:block absolute top-20 right-4 w-48 bg-night-950/80 border border-plush-700/30 rounded-lg p-2 max-h-40 overflow-y-auto focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass-400"
      >
        <div className="text-brass-300 text-xs font-display font-bold mb-1">Battle Log</div>
        {battleLog.map(entry => (
          <div key={entry.id} className="text-plush-200 text-xs py-0.5 border-b border-white/10">
            {entry.message}
          </div>
        ))}
      </div>

      {/* Main battlefield */}
      <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-4/5 h-1/3 bg-gradient-to-b from-felt-700 to-felt-800 rounded-xl border-4 border-[#0a1a12] stitched shadow-[inset_0_4px_24px_rgba(0,0,0,0.5)] flex flex-col justify-between p-4">
        {/* Phase indicator */}
        <div className="absolute -top-8 left-1/2 transform -translate-x-1/2 bg-brass-500 text-night-950 px-3 sm:px-4 py-1 rounded-t-lg font-display font-bold text-sm sm:text-base whitespace-nowrap">
          Turn {turnCount} - {phase.charAt(0).toUpperCase() + phase.slice(1)} Phase
          {currentTurn === 'opponent' && ' (Opponent)'}
        </div>

        {/* Momentum gauge — glows and pulses when full to signal Rally is ready. */}
        <div className="absolute -left-4 top-1/2 transform -translate-y-1/2 -rotate-90 origin-center">
          <motion.div
            className="flex items-center space-x-2 rounded-full px-2 py-0.5"
            animate={playerMomentum >= MOMENTUM_MAX
              ? { boxShadow: ['0 0 0px #fbbf24', '0 0 12px #fbbf24', '0 0 0px #fbbf24'] }
              : { boxShadow: '0 0 0px transparent' }}
            transition={playerMomentum >= MOMENTUM_MAX ? { duration: 1.2, repeat: Infinity } : {}}
          >
            <span className={`text-xs font-semibold ${playerMomentum >= MOMENTUM_MAX ? 'text-brass-200' : 'text-brass-300'}`}>Momentum</span>
            <Progress
              value={playerMomentum * 10}
              className="w-24 h-2 bg-night-950/50 [&>div]:bg-brass-400"
              aria-label={`Momentum: ${playerMomentum} of ${MOMENTUM_MAX}`}
            />
            <span className={`text-xs font-bold ${playerMomentum >= MOMENTUM_MAX ? 'text-brass-200' : 'text-brass-300'}`}>{playerMomentum}/10</span>
          </motion.div>
        </div>

        {/* Latest-event ticker (phones only) — the full battle-log panel is
            hidden below md because it covers the opponent's cards; the
            battlefield's top half is guaranteed empty, so surface the most
            recent entry here instead. */}
        {battleLog.length > 0 && (
          <div
            aria-live="polite"
            className="md:hidden self-center max-w-full bg-night-950/80 text-plush-200 text-xs px-3 py-1 rounded-full truncate pointer-events-none"
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
                ${selectedCard?.instanceId === card.instanceId ? 'ring-2 ring-brass-300' : ''}
                ${card.type === 'action' && !canAttack(card) ? 'opacity-60' : 'cursor-pointer'}
              `}
              /* Always delegate to selectCardForAttack rather than
                 short-circuiting here: it owns every rejection message
                 (trap / exhausted / summoning-sick), so a player who taps an
                 unavailable creature is told why instead of getting silence. */
              {...pressable(() => phase === 'battle' && selectCardForAttack(card), `Select ${card.name} to attack`)}
            >
              <TeddyCard teddy={card} cosmeticBorder={cosmeticBorder} />
              {card.hasAttacked && (
                <div className="text-center text-xs text-plush-300 mt-1">Exhausted</div>
              )}
              {card.summoningSick && !card.hasAttacked && (
                <div className="text-center text-xs text-plush-300 mt-1">Warming Up</div>
              )}
              {card.stealthActive && (
                <div className="absolute top-[20px] left-0 right-0 bg-purple-500/90 text-white text-[8px] text-center z-10">
                  STEALTH
                </div>
              )}
              {card.ability === 'taunt' && !card.stealthActive && (
                <div className="absolute -top-2 left-1/2 transform -translate-x-1/2 bg-brass-400 text-night-950 text-[8px] px-1 rounded">
                  TAUNT
                </div>
              )}
            </motion.div>
          ))}
        </div>
      </div>

      {/* Player's hand — caps width and scrolls horizontally so a full hand
          stays reachable on phones instead of overflowing off-screen. */}
      <div className="absolute bottom-20 left-1/2 transform -translate-x-1/2 flex justify-start md:justify-center space-x-2 max-w-[96vw] overflow-x-auto px-4 pt-8 pb-3">
        <AnimatePresence>
          {playerHand.map((card, index) => (
            <motion.div
              key={card.instanceId}
              initial={{ y: 50, opacity: 0 }}
              animate={{ y: 0, opacity: 1, rotate: (index - playerHand.length / 2) * 3 }}
              exit={{ y: 50, opacity: 0 }}
              whileHover={{ y: -20, scale: 1.1, zIndex: 10 }}
              style={{ transformOrigin: 'bottom center' }}
              className={`cursor-pointer ${playerEnergy < effectiveCost(card, playerField) ? 'opacity-50' : ''}`}
              {...pressable(() => phase === 'main' && playCard(card), `Play ${card.name}`)}
            >
              <TeddyCard teddy={card} cosmeticBorder={cosmeticBorder} />
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Bottom bar - Player info */}
      <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-r from-felt-900 to-felt-800 flex items-center justify-between px-4 shadow-lg">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-gradient-to-br from-amber-400 to-orange-500 rounded-full border-2 border-white flex items-center justify-center shadow-lg">
            <span className="text-white text-xl">🧸</span>
          </div>
          <div className="min-w-0">
            <div className="text-white font-bold truncate max-w-[7rem] sm:max-w-none">{playerName}</div>
            <div className="text-emerald-200 text-xs whitespace-nowrap">Deck: {playerDeck.length} | Hand: {playerHand.length}</div>
          </div>
          {/* Player's draw pile */}
          {playerDeck.length > 0 && (
            <div className="relative w-8 h-11 shrink-0 hidden sm:block" aria-hidden="true">
              <div className="absolute inset-0 -rotate-6"><CardBack className="w-8 h-11" mini /></div>
              <div className="absolute inset-0 rotate-3"><CardBack className="w-8 h-11" mini /></div>
              <CardBack className="w-8 h-11" mini />
            </div>
          )}
        </div>
        <div className="flex items-center space-x-2 sm:space-x-4">
          <div className="flex items-center space-x-1 sm:space-x-2">
            <span className="text-brass-300 text-lg">⚡</span>
            <span className="text-white font-bold">{playerEnergy}</span>
          </div>
          <div className="text-right">
            <div className="text-white text-sm">HP</div>
            <motion.div
              key={playerHealth}
              initial={{ scale: 1.6, color: '#fca5a5' }}
              animate={{ scale: 1, color: '#ece6f2' }}
              transition={{ type: 'spring', stiffness: 400, damping: 14 }}
              className="font-bold text-lg sm:text-xl whitespace-nowrap"
            >
              {playerHealth}/30
            </motion.div>
          </div>
          <Progress
            value={(playerHealth / 30) * 100}
            className="w-16 sm:w-32 h-3 bg-felt-900 [&>div]:bg-emerald-400"
            aria-label={`Your health: ${playerHealth} of 30`}
          />
        </div>
      </div>

      {/* Game controls */}
      {/* On phones the old right-side stack rendered on top of the hand, so
          lay the controls out as a compact horizontal row anchored just under
          the battlefield (which ends at 2/3 viewport height) — a fixed
          bottom offset overlapped the player's field cards on short phones.
          sm+ keeps the vertical right-side stack. */}
      {/* flex-wrap matters on phones: with both Battle Pass emotes owned AND a
          full momentum gauge, emotes + Rally + the turn buttons exceed 390px.
          The row sits inside the board's overflow-hidden with justify-center,
          so without wrapping the spill is clipped at BOTH ends — the first
          emote and Concede's right edge become untappable. Wrapping drops the
          overflow onto a second row instead. */}
      <div className="absolute top-[calc(66.67%+0.5rem)] inset-x-2 flex flex-row flex-wrap justify-center gap-2 sm:top-auto sm:inset-x-auto sm:bottom-20 sm:right-4 sm:flex-col sm:w-36">
        {/* Battle Pass emote cosmetics — only rendered once unlocked. Usable on
            either turn (heckling Chuck mid-swing is the point). */}
        {!gameOver && emotes.length > 0 && (
          <div className="flex flex-row justify-center gap-2 sm:w-full">
            {emotes.map((emote) => (
              <Button
                key={emote.name}
                onClick={() => sendEmote(emote)}
                aria-label={emote.name}
                title={emote.name}
                className="flex-none h-8 w-8 p-0 text-base sm:h-10 sm:w-10 sm:text-lg bg-night-800/90 hover:bg-night-700 border border-brass-400/40"
              >
                {emote.icon}
              </Button>
            ))}
          </div>
        )}
        {targetingMode && (
          <Button
            className="flex-none h-9 px-3 text-sm sm:h-10 sm:px-4 sm:text-base sm:w-full bg-plush-700 hover:bg-plush-800 text-white"
            onClick={cancelTargeting}
          >
            Cancel
          </Button>
        )}
        {!gameOver && playerMomentum >= MOMENTUM_MAX && currentTurn === 'player' && (
          <Button
            className="flex-none h-9 px-3 text-sm sm:h-10 sm:px-4 sm:text-base sm:w-full bg-gradient-to-r from-brass-400 to-brass-500 hover:from-brass-500 hover:to-brass-600 text-night-950 font-display font-bold animate-pulse"
            onClick={rally}
          >
            ⚡ Rally!
          </Button>
        )}
        {!gameOver && phase === 'main' && currentTurn === 'player' && (
          <Button
            className="flex-none h-9 px-3 text-sm sm:h-10 sm:px-4 sm:text-base sm:w-full bg-red-600 hover:bg-red-700 text-white font-display"
            onClick={goToBattlePhase}
          >
            ⚔️ Battle
          </Button>
        )}
        {!gameOver && (phase === 'main' || phase === 'battle') && currentTurn === 'player' && (
          <Button
            className="flex-none h-9 px-3 text-sm sm:h-10 sm:px-4 sm:text-base sm:w-full bg-emerald-600 hover:bg-emerald-700 text-white font-display"
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
        <div className="absolute top-1/2 left-4 transform -translate-y-1/2 bg-brass-400 text-night-950 px-3 py-2 rounded-lg font-bold animate-pulse">
          Pick a victim for {selectedCard?.name}!
        </div>
      )}
    </div>
  );
};

export default GameBoard;
