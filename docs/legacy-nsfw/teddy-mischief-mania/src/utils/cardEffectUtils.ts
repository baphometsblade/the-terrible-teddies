
import { TeddyCard } from "@/lib/types";
import { determineCardType, hasCardSynergy } from "./cardTypeUtils";

/**
 * Checks if two cards form a valid combo based on their types and stats
 */
export const isCardCombo = (card1: TeddyCard, card2: TeddyCard): boolean => {
  // Check for type synergy between cards
  const hasSynergy = hasCardSynergy(card1, card2);
  
  // Check for high-stat combos
  const isHighAttackCombo = card1.attack >= 7 && card2.attack >= 7;
  const isHighDefenseCombo = card1.defense >= 7 && card2.defense >= 7;
  const isSpecialMoveCombo = Boolean(card1.specialMove && card2.specialMove);
  const isNaughtyCombo = card1.fluff && card2.fluff && card1.fluff >= 6 && card2.fluff >= 6;
  
  // Combined check for any valid combo
  return hasSynergy || isHighAttackCombo || isHighDefenseCombo || isSpecialMoveCombo || isNaughtyCombo;
};

/**
 * Calculate the combo power multiplier based on the cards involved
 */
export const calculateComboMultiplier = (card1: TeddyCard, card2: TeddyCard): number => {
  let multiplier = 1.2; // Base multiplier for any combo
  
  // Add bonus for matching types
  const type1 = determineCardType(card1);
  const type2 = determineCardType(card2);
  
  if (type1 === type2) {
    multiplier += 0.3; // Same type bonus
  }
  
  // Add bonus for special moves
  if (card1.specialMove && card2.specialMove) {
    multiplier += 0.5; // Double special move bonus
  }
  
  // Add bonus for high stats
  if (card1.attack >= 8 && card2.attack >= 8) {
    multiplier += 0.2; // High attack bonus
  }
  
  if (card1.defense >= 8 && card2.defense >= 8) {
    multiplier += 0.2; // High defense bonus
  }
  
  if (card1.fluff && card2.fluff && card1.fluff >= 8 && card2.fluff >= 8) {
    multiplier += 0.3; // High fluff bonus
  }
  
  // Cap the multiplier
  return Math.min(multiplier, 2.5);
};

/**
 * Generates a suggestive description for the combo effect
 */
export const getComboDescription = (card1: TeddyCard, card2: TeddyCard, gameMode: "naughty" | "nasty"): string => {
  const type1 = determineCardType(card1, gameMode);
  const type2 = determineCardType(card2, gameMode);
  
  // Same type combos
  if (type1 === type2) {
    switch (type1) {
      case "ATTACK":
        return "Double the thrust, double the pleasure! This powerful combo penetrates all defenses.";
      case "DEFENSE":
        return "An impenetrable wall of fluff that can take whatever you throw at it - and ask for more!";
      case "SPECIAL":
        return "Two special bears working together to create a climax of unimaginable intensity!";
      case "NAUGHTY":
        return "The seductive power of these two will have you begging for mercy... but not really wanting it.";
      case "NASTY":
        return "Brutality taken to new heights as these two dominate the field with raw, uninhibited power.";
      default:
        return "These two bears know exactly how to please each other and defeat you at the same time.";
    }
  }
  
  // Mixed type combos
  if ((type1 === "ATTACK" && type2 === "DEFENSE") || (type1 === "DEFENSE" && type2 === "ATTACK")) {
    return "The perfect balance of hard and soft - one pushes in while the other cushions the blow.";
  }
  
  if ((type1 === "NAUGHTY" && type2 === "NASTY") || (type1 === "NASTY" && type2 === "NAUGHTY")) {
    return "Sweet seduction meets raw dominance in this extreme pairing that will leave you breathless.";
  }
  
  // Default combo description
  return "These two bears have found their rhythm together, and the results are explosively satisfying.";
};

/**
 * Generates a prompt for image generation based on card details
 */
export const getImageGenerationPrompt = (card: TeddyCard, mode: string): string => {
  return `Generate a ${mode} teddy bear card image for ${card.name}`;
};
