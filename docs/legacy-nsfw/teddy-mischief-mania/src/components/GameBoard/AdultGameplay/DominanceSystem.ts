
import { TeddyCard } from "@/lib/types";
import { GameMode } from "@/lib/types/battleTypes";
import { determineBearPersonality } from "@/utils/cardUtils";

// Calculate the dominance factor between two cards based on game mode
export const calculateDominance = (
  attackerCard: TeddyCard, 
  defenderCard: TeddyCard, 
  gameMode: GameMode
): number => {
  // Get card personalities
  const attackerPersonality = determineBearPersonality(attackerCard);
  const defenderPersonality = determineBearPersonality(defenderCard);
  
  // Base dominance from stats
  let dominance = 0;
  
  // In naughty mode, fluff is more important for dominance
  if (gameMode === 'naughty') {
    dominance = (attackerCard.fluff * 0.5) + (attackerCard.attack * 0.3) + (attackerCard.defense * 0.2);
    
    // Personality synergies in naughty mode
    if (attackerPersonality === 'naughty' && defenderPersonality === 'nasty') {
      // Naughty attacker against nasty defender gets bonus (seduction works well against brutes)
      dominance *= 1.3;
    } else if (attackerPersonality === 'nasty' && defenderPersonality === 'naughty') {
      // Nasty attacker against naughty defender gets penalty (too rough)
      dominance *= 0.8;
    }
  } 
  // In nasty mode, attack is more important
  else {
    dominance = (attackerCard.attack * 0.5) + (attackerCard.fluff * 0.2) + (attackerCard.defense * 0.3);
    
    // Personality synergies in nasty mode
    if (attackerPersonality === 'nasty' && defenderPersonality === 'naughty') {
      // Nasty attacker against naughty defender gets bonus (brute force works on soft targets)
      dominance *= 1.3;
    } else if (attackerPersonality === 'naughty' && defenderPersonality === 'nasty') {
      // Naughty attacker against nasty defender gets penalty (too soft)
      dominance *= 0.7;
    }
  }
  
  // Special move bonus
  if (attackerCard.specialMove) {
    dominance *= 1.2;
  }
  
  return dominance;
};

// Determine if submission is triggered (defender gives up)
export const checkForSubmission = (
  dominanceFactor: number,
  defenderCard: TeddyCard,
  gameMode: GameMode,
  turnCount: number
): boolean => {
  // Base submission threshold
  const baseThreshold = 10;
  
  // Adjust threshold based on game mode and defender type
  let adjustedThreshold = baseThreshold;
  const defenderPersonality = determineBearPersonality(defenderCard);
  
  if (gameMode === 'naughty') {
    // In naughty mode, submission is more likely as the game progresses
    adjustedThreshold -= turnCount * 0.5;
    
    // Personality factors
    if (defenderPersonality === 'naughty') {
      // Naughty cards submit more easily in naughty mode
      adjustedThreshold -= 2;
    } else if (defenderPersonality === 'nasty') {
      // Nasty cards resist submission in naughty mode
      adjustedThreshold += 3;
    }
  } else {
    // In nasty mode, submission requires more dominance
    adjustedThreshold += 2;
    
    // Personality factors
    if (defenderPersonality === 'nasty') {
      // Nasty cards might submit to other nasty cards
      adjustedThreshold -= 1;
    } else if (defenderPersonality === 'naughty') {
      // Naughty cards submit more quickly to nasty dominance
      adjustedThreshold -= 3;
    }
  }
  
  // Check if dominance exceeds threshold
  return dominanceFactor > adjustedThreshold;
};

// Generate submission dialogue
export const getSubmissionDialogue = (
  attackerCard: TeddyCard,
  defenderCard: TeddyCard,
  gameMode: GameMode
): string => {
  const attackerName = attackerCard.name;
  const defenderName = defenderCard.name;
  
  const naughtySubmissions = [
    `${defenderName} melts under ${attackerName}'s seductive touch, unable to resist any longer.`,
    `With a sultry moan, ${defenderName} surrenders completely to ${attackerName}'s charms.`,
    `${defenderName} blushes deeply as ${attackerName} whispers exactly what they want to hear.`,
    `"You win," ${defenderName} whispers, eyes glazed with desire as ${attackerName} takes control.`,
    `${defenderName} quivers with anticipation, fully submitting to ${attackerName}'s every whim.`
  ];
  
  const nastySubmissions = [
    `${defenderName} drops to their knees, completely dominated by ${attackerName}'s power.`,
    `"I submit," ${defenderName} gasps as ${attackerName} asserts total control.`,
    `${defenderName} can't take anymore, surrendering to ${attackerName}'s superior force.`,
    `With a whimper of defeat, ${defenderName} accepts ${attackerName} as their master.`,
    `${defenderName} is broken, now existing only to serve ${attackerName}'s desires.`
  ];
  
  const submissions = gameMode === 'naughty' ? naughtySubmissions : nastySubmissions;
  return submissions[Math.floor(Math.random() * submissions.length)];
};

// Check for special reactions based on card combinations
export const getSpecialInteraction = (
  attackerCard: TeddyCard,
  defenderCard: TeddyCard,
  gameMode: GameMode
): string | null => {
  const attackerName = attackerCard.name.toLowerCase();
  const defenderName = defenderCard.name.toLowerCase();
  
  // Special gender interactions
  if ((attackerName.includes("dom") || attackerName.includes("master") || attackerName.includes("mistress")) &&
      (defenderName.includes("sub") || defenderName.includes("slave") || defenderName.includes("pet"))) {
    return gameMode === 'naughty'
      ? `${attackerCard.name} recognizes a perfect submissive in ${defenderCard.name}, forming an instant connection.`
      : `${attackerCard.name} sees the submissive nature of ${defenderCard.name} and takes immediate control.`;
  }
  
  // Opposites attract
  if ((attackerName.includes("sweet") || attackerName.includes("innocent") || attackerName.includes("pure")) &&
      (defenderName.includes("dark") || defenderName.includes("devil") || defenderName.includes("sin"))) {
    return gameMode === 'naughty'
      ? `${attackerCard.name}'s innocence is irresistible to the dark desires of ${defenderCard.name}.`
      : `${attackerCard.name}'s purity is corrupted by the sinful influence of ${defenderCard.name}.`;
  }
  
  // Same type resonance
  if ((attackerName.includes("bondage") && defenderName.includes("bondage")) ||
      (attackerName.includes("leather") && defenderName.includes("leather")) ||
      (attackerName.includes("latex") && defenderName.includes("latex"))) {
    return gameMode === 'naughty'
      ? `${attackerCard.name} and ${defenderCard.name} share a deep understanding of each other's desires.`
      : `${attackerCard.name} and ${defenderCard.name} recognize each other as equals in their intensity.`;
  }
  
  // No special interaction
  return null;
};
