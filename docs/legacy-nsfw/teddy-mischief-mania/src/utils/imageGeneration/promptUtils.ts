
import { TeddyCard } from "@/lib/types";

/**
 * Generate a thematic prompt for a teddy card
 * This is used for naming and description rather than AI generation now
 */
export const generatePromptForCard = (card: TeddyCard): string => {
  // Analyze card properties to create a thematic description
  const isAttackFocused = card.attack > card.defense;
  const isHighFluff = card.fluff > 5;
  const isLegendary = card.rarity === "Legendary" || card.rarity === "Epic";
  
  // Build theme words based on card properties
  let themeWords = [];
  
  // Add attribute-based descriptors
  if (isAttackFocused) {
    themeWords.push(...["aggressive", "dominant", "fierce", "powerful"]);
  } else {
    themeWords.push(...["defensive", "enduring", "resilient", "steadfast"]);
  }
  
  // Add fluff-based descriptors
  if (isHighFluff) {
    themeWords.push(...["fluffy", "soft", "plush", "cuddly", "huggable"]);
  } else {
    themeWords.push(...["firm", "solid", "tough", "sturdy"]);
  }
  
  // Add rarity-based descriptors
  if (isLegendary) {
    themeWords.push(...["legendary", "mythical", "rare", "extraordinary", "exceptional"]);
  }
  
  // Add card name-based descriptors
  if (card.name.toLowerCase().includes("love") || 
      card.name.toLowerCase().includes("heart") || 
      card.name.toLowerCase().includes("kiss")) {
    themeWords.push(...["romantic", "passionate", "loving", "affectionate"]);
  }
  
  if (card.name.toLowerCase().includes("dark") || 
      card.name.toLowerCase().includes("shadow") || 
      card.name.toLowerCase().includes("night")) {
    themeWords.push(...["mysterious", "shadowy", "dark", "enigmatic"]);
  }
  
  if (card.name.toLowerCase().includes("fire") || 
      card.name.toLowerCase().includes("flame") || 
      card.name.toLowerCase().includes("burn")) {
    themeWords.push(...["fiery", "blazing", "hot", "burning"]);
  }
  
  // Shuffle and select random words to make description dynamic
  const shuffled = themeWords.sort(() => 0.5 - Math.random());
  const selectedWords = shuffled.slice(0, 3);
  
  return `${selectedWords.join(", ")} teddy bear, ${card.name}`;
};

/**
 * Generate a suggestive description for a teddy card
 */
export const generateCardDescription = (card: TeddyCard, mode: "naughty" | "nasty"): string => {
  const naughtyDescriptions = [
    "Makes your heart race with anticipation",
    "Knows exactly where to touch",
    "Whispers sweet nothings in your ear",
    "Leaves you begging for more",
    "Makes you blush with just a glance",
    "Fluffy in all the right places",
    "Knows how to cuddle all night long",
    "Will make your stuffing tingle"
  ];
  
  const nastyDescriptions = [
    "Tears opponents apart seam by seam",
    "Rips stuffing out without mercy",
    "Leaves nothing but button eyes behind",
    "Crushes opponents with brute force",
    "Shows no mercy in battle",
    "Will make you scream in agony",
    "Dominates the battlefield with ease",
    "Causes pain just by looking at you"
  ];
  
  const descriptions = mode === "naughty" ? naughtyDescriptions : nastyDescriptions;
  return descriptions[Math.floor(Math.random() * descriptions.length)];
};
