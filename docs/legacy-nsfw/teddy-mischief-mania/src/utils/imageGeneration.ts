
import { TeddyCard } from "@/lib/types";
import { toast } from "sonner";
import { getRandomCommentary } from "./commentary";

// Predefined card images for each rarity level
const cardImagesByRarity: Record<string, string[]> = {
  Common: [
    "/assets/cards/common/teddy1.png",
    "/assets/cards/common/teddy2.png",
    "/assets/cards/common/teddy3.png",
    "/assets/cards/common/teddy4.png",
  ],
  Uncommon: [
    "/assets/cards/uncommon/teddy1.png",
    "/assets/cards/uncommon/teddy2.png",
    "/assets/cards/uncommon/teddy3.png",
  ],
  Rare: [
    "/assets/cards/rare/teddy1.png",
    "/assets/cards/rare/teddy2.png",
    "/assets/cards/rare/teddy3.png",
  ],
  Epic: [
    "/assets/cards/epic/teddy1.png",
    "/assets/cards/epic/teddy2.png",
  ],
  Legendary: [
    "/assets/cards/legendary/teddy1.png",
    "/assets/cards/legendary/teddy2.png",
  ]
};

// Special card backs for different card types
const naughtyCardBacks = [
  "/assets/cards/backs/naughty1.png",
  "/assets/cards/backs/naughty2.png",
  "/assets/cards/backs/naughty3.png",
];

const nastyCardBacks = [
  "/assets/cards/backs/nasty1.png",
  "/assets/cards/backs/nasty2.png",
  "/assets/cards/backs/nasty3.png",
];

/**
 * Generate a teddy image for a card
 * Uses predefined images instead of AI generation
 */
export const generateTeddyImage = async (
  card: TeddyCard, 
  mode: 'naughty' | 'nasty' = 'naughty'
): Promise<string> => {
  try {
    // Show a toast indicating the image is being "generated"
    toast.info(`"Generating" a teddy image for ${card.name}...`);
    
    // Simulate API delay for realism
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    // Select an image based on card rarity
    const rarityImages = cardImagesByRarity[card.rarity] || cardImagesByRarity.Common;
    const randomImage = rarityImages[Math.floor(Math.random() * rarityImages.length)];
    
    // Success message with random commentary
    const commentary = getRandomCommentary("special", mode, 2, 4);
    toast.success(`Teddy image ready!`, {
      description: commentary
    });
    
    return randomImage;
  } catch (error) {
    console.error("Error generating teddy image:", error);
    toast.error("Failed to generate teddy image");
    
    // Return a fallback image
    return mode === 'naughty' 
      ? "/assets/cards/fallback/naughty.png" 
      : "/assets/cards/fallback/nasty.png";
  }
};

/**
 * Generate a card back image
 */
export const generateCardBackImage = (mode: 'naughty' | 'nasty'): string => {
  const backImages = mode === 'naughty' ? naughtyCardBacks : nastyCardBacks;
  return backImages[Math.floor(Math.random() * backImages.length)];
};

/**
 * Function to generate prompts for cards
 */
export const generatePromptForCard = (card: TeddyCard): string => {
  // This is just for backward compatibility, we're not using AI generation anymore
  const attackFocused = card.attack > card.defense;
  const isLegendary = card.rarity === "Legendary" || card.rarity === "Epic";
  
  let basePrompt = "teddy bear, stuffed animal, ";
  
  if (isLegendary) {
    basePrompt += "high quality, detailed, ornate accessories, ";
  }
  
  if (attackFocused) {
    basePrompt += "powerful, aggressive, ";
  } else {
    basePrompt += "defensive, enduring, ";
  }
  
  basePrompt += card.name;
  
  return basePrompt;
};
