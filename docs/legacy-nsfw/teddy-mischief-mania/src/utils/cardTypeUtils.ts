
import { Heart, Shield, Skull, Sparkles, Zap, Flame, Target, Crown } from "lucide-react";
import { CardType, CardTypeConfig } from "@/components/TeddyCard/types";
import { TeddyCard } from "@/lib/types";
import { GameMode } from "@/lib/types/battleTypes";

// Export CardType enum to resolve the error
export { CardType };

// Card type configurations with icons and colors
export const cardTypeConfigs: Record<CardType, CardTypeConfig> = {
  [CardType.ATTACK]: {
    name: "Attack",
    icon: Zap,
    color: "text-red-500",
    description: "High damage potential against opponent"
  },
  [CardType.DEFENSE]: {
    name: "Defense",
    icon: Shield,
    color: "text-blue-500",
    description: "Protects against opponent attacks"
  },
  [CardType.SPECIAL]: {
    name: "Special",
    icon: Sparkles,
    color: "text-yellow-500",
    description: "Unique and powerful special abilities"
  },
  [CardType.NAUGHTY]: {
    name: "Naughty",
    icon: Heart,
    color: "text-rose-500",
    description: "Seductive and manipulative tactics"
  },
  [CardType.NASTY]: {
    name: "Nasty",
    icon: Skull,
    color: "text-violet-500",
    description: "Brutal and aggressive strategies"
  },
  [CardType.SEDUCTION]: {
    name: "Seduction",
    icon: Flame,
    color: "text-pink-500",
    description: "Distracts and weakens opponent defenses"
  },
  [CardType.BRUTALITY]: {
    name: "Brutality",
    icon: Target,
    color: "text-purple-700",
    description: "Devastating attacks that cause lasting damage"
  },
  [CardType.FINISHER]: {
    name: "Finisher",
    icon: Crown,
    color: "text-amber-500",
    description: "Game-ending moves when opponent is weakened"
  }
};

/**
 * Determines the primary card type based on card properties and game mode
 */
export function determineCardType(card: TeddyCard, gameMode: GameMode = "naughty"): CardType {
  // Finisher cards (special moves that can end the game)
  if (card.specialMove && (
      card.specialMove.toLowerCase().includes("finish") || 
      card.specialMove.toLowerCase().includes("climax") ||
      card.specialMove.toLowerCase().includes("ultimate")
    )) {
    return CardType.FINISHER;
  }
  
  // Special move cards
  if (card.specialMove) {
    return CardType.SPECIAL;
  }
  
  // High attack cards
  if (card.attack >= 8) {
    return gameMode === "nasty" ? CardType.BRUTALITY : CardType.ATTACK;
  }
  
  // High defense cards
  if (card.defense >= 8) {
    return CardType.DEFENSE;
  }
  
  // High fluff cards (seduction)
  if (card.fluff && card.fluff >= 8) {
    return CardType.SEDUCTION;
  }
  
  // Default to mode-based type
  return gameMode === "naughty" ? CardType.NAUGHTY : CardType.NASTY;
}

/**
 * Gets multiple card types for a card (primary and secondary types)
 */
export function getCardTypes(card: TeddyCard, gameMode: GameMode = "naughty"): CardType[] {
  const types: CardType[] = [];
  
  // Add primary type
  const primaryType = determineCardType(card, gameMode);
  types.push(primaryType);
  
  // Add secondary types based on stats
  if (!types.includes(CardType.ATTACK) && card.attack >= 6) {
    types.push(CardType.ATTACK);
  }
  
  if (!types.includes(CardType.DEFENSE) && card.defense >= 6) {
    types.push(CardType.DEFENSE);
  }
  
  if (!types.includes(CardType.SEDUCTION) && card.fluff && card.fluff >= 6) {
    types.push(CardType.SEDUCTION);
  }
  
  // Add mode-specific type if not already included
  const modeType = gameMode === "naughty" ? CardType.NAUGHTY : CardType.NASTY;
  if (!types.includes(modeType)) {
    types.push(modeType);
  }
  
  return types;
}

/**
 * Checks if a card has specific synergy with another card
 */
export function hasCardSynergy(card1: TeddyCard, card2: TeddyCard, gameMode: GameMode = "naughty"): boolean {
  const card1Types = getCardTypes(card1, gameMode);
  const card2Types = getCardTypes(card2, gameMode);
  
  // Check for type match
  return card1Types.some(type => card2Types.includes(type));
}

/**
 * Get a suggestive description for a card's type
 */
export function getSuggestiveTypeDescription(card: TeddyCard, gameMode: GameMode = "naughty"): string {
  const cardType = determineCardType(card, gameMode);
  
  const suggestiveDescriptions: Record<CardType, string[]> = {
    [CardType.ATTACK]: [
      "Knows just where to hit to make you moan",
      "Delivers pleasure with an aggressive edge",
      "Strikes deep where you feel it most"
    ],
    [CardType.DEFENSE]: [
      "Builds walls that need special attention to penetrate",
      "Knows how to resist even the most tempting advances",
      "Stays firm against all attempts to break through"
    ],
    [CardType.SPECIAL]: [
      "Has tricks that will leave you breathless",
      "Specializes in moves you've never experienced before",
      "Will surprise you with unexpected sensations"
    ],
    [CardType.NAUGHTY]: [
      "Teases until you beg for more",
      "Seduces with just a glance",
      "Knows exactly what you desire before you do"
    ],
    [CardType.NASTY]: [
      "Dominates with unrelenting force",
      "Doesn't stop until you surrender completely",
      "Takes what it wants without asking permission"
    ],
    [CardType.SEDUCTION]: [
      "Melts your defenses with a whisper",
      "Makes resistance futile and surrender inevitable",
      "Turns your 'no' into 'yes, please' with a touch"
    ],
    [CardType.BRUTALITY]: [
      "Leaves marks that remind you who's in charge",
      "Doesn't believe in safe words, only in taking control",
      "Breaks through boundaries with overwhelming power"
    ],
    [CardType.FINISHER]: [
      "Brings you to the ultimate climax",
      "Delivers the final blow that leaves you spent",
      "Finishes you off in ways you'll never forget"
    ]
  };
  
  const descriptions = suggestiveDescriptions[cardType];
  return descriptions[Math.floor(Math.random() * descriptions.length)];
}
