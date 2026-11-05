
import { GameMode } from "@/lib/types/battleTypes";
import { TeddyCard } from "@/lib/types";

/**
 * Calculates seduction power for a card in Naughty mode
 */
export const calculateSeductionPower = (card: TeddyCard, intensity: number = 1): number => {
  // Base formula: fluff + (attack * 0.3) + special bonus
  const hasSeductiveKeywords = card.specialMove?.toLowerCase().includes("seduc") ||
    card.name.toLowerCase().includes("charm") ||
    card.description?.toLowerCase().includes("tempt");
    
  const specialBonus = hasSeductiveKeywords ? 3 : 0;
  
  return Math.floor((card.fluff + (card.attack * 0.3) + specialBonus) * intensity);
};

/**
 * Calculates brutality power for a card in Nasty mode
 */
export const calculateBrutalityPower = (card: TeddyCard, intensity: number = 1): number => {
  // Base formula: attack + (defense * 0.3) + special bonus
  const hasBrutalKeywords = card.specialMove?.toLowerCase().includes("rip") ||
    card.name.toLowerCase().includes("brut") ||
    card.description?.toLowerCase().includes("destroy");
    
  const specialBonus = hasBrutalKeywords ? 3 : 0;
  
  return Math.floor((card.attack + (card.defense * 0.3) + specialBonus) * intensity);
};

/**
 * Calculate dominance factor based on current game state
 * Positive values = player dominance, negative values = opponent dominance
 */
export const calculateDominanceFactor = (
  playerSeduction: number,
  playerBrutality: number,
  opponentSeduction: number,
  opponentBrutality: number,
  gameMode: GameMode
): number => {
  if (gameMode === "naughty") {
    return Math.min(20, playerSeduction - opponentSeduction);
  } else {
    return Math.min(20, playerBrutality - opponentBrutality);
  }
};

/**
 * Types of adult-themed special actions
 */
export type AdultSpecialAction = "seduce" | "dominate" | "tease" | "punish";

/**
 * Perform special action based on current game state
 */
export const performSpecialAction = (
  actionType: AdultSpecialAction,
  gameMode: GameMode,
  playerSeduction: number,
  playerBrutality: number
): { success: boolean; cost: number; effect: number } => {
  // Check if player has enough resources
  const requiredResource = actionType === "seduce" || actionType === "tease" 
    ? playerSeduction
    : playerBrutality;
    
  const minimumRequired = actionType === "tease" || actionType === "punish" ? 5 : 10;
  
  if (requiredResource < minimumRequired) {
    return { success: false, cost: minimumRequired, effect: 0 };
  }
  
  // Calculate effect and cost based on action type
  let effect = 0;
  let cost = 0;
  
  switch (actionType) {
    case "seduce":
      effect = Math.floor(playerSeduction * 0.6);
      cost = 10;
      break;
    case "tease":
      effect = Math.floor(playerSeduction * 0.3);
      cost = 5;
      break;
    case "dominate":
      effect = Math.floor(playerBrutality * 0.6);
      cost = 10;
      break;
    case "punish":
      effect = Math.floor(playerBrutality * 0.3);
      cost = 5;
      break;
  }
  
  return { success: true, cost, effect };
};
