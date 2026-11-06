
// Re-export all functionality from the image generation modules
export * from "./promptUtils";
export * from "./supabaseUtils";

// Main image generation function
import { TeddyCard } from "@/lib/types";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { generatePromptForCard } from "./promptUtils";
import { updateCardImage } from "./supabaseUtils";

// Card image collections by rarity and type
const cardImages = {
  Common: {
    naughty: [
      "/assets/cards/common/naughty1.png",
      "/assets/cards/common/naughty2.png",
      "/assets/cards/common/naughty3.png",
      "/assets/cards/common/naughty4.png",
      "/assets/cards/common/naughty5.png",
    ],
    nasty: [
      "/assets/cards/common/nasty1.png",
      "/assets/cards/common/nasty2.png",
      "/assets/cards/common/nasty3.png",
      "/assets/cards/common/nasty4.png",
      "/assets/cards/common/nasty5.png",
    ]
  },
  Uncommon: {
    naughty: [
      "/assets/cards/uncommon/naughty1.png",
      "/assets/cards/uncommon/naughty2.png",
      "/assets/cards/uncommon/naughty3.png",
    ],
    nasty: [
      "/assets/cards/uncommon/nasty1.png",
      "/assets/cards/uncommon/nasty2.png",
      "/assets/cards/uncommon/nasty3.png",
    ]
  },
  Rare: {
    naughty: [
      "/assets/cards/rare/naughty1.png",
      "/assets/cards/rare/naughty2.png",
      "/assets/cards/rare/naughty3.png",
    ],
    nasty: [
      "/assets/cards/rare/nasty1.png",
      "/assets/cards/rare/nasty2.png",
      "/assets/cards/rare/nasty3.png",
    ]
  },
  Epic: {
    naughty: [
      "/assets/cards/epic/naughty1.png",
      "/assets/cards/epic/naughty2.png",
    ],
    nasty: [
      "/assets/cards/epic/nasty1.png",
      "/assets/cards/epic/nasty2.png",
    ]
  },
  Legendary: {
    naughty: [
      "/assets/cards/legendary/naughty1.png",
      "/assets/cards/legendary/naughty2.png",
    ],
    nasty: [
      "/assets/cards/legendary/nasty1.png",
      "/assets/cards/legendary/nasty2.png",
    ]
  }
};

/**
 * Generate a teddy image for a card (combines prefab assets with potential AI generation)
 */
export const generateTeddyImage = async (
  card: TeddyCard, 
  mode: 'naughty' | 'nasty'
): Promise<string> => {
  try {
    toast.info(`Preparing ${mode} image for ${card.name}...`);
    
    // First try to use AI generation if online
    try {
      const prompt = generatePromptForCard(card);
      
      const { data, error } = await supabase.functions.invoke('huggingface-image-generator', {
        body: { 
          prompt,
          type: mode,
          negative_prompt: "deformed, bad anatomy, disfigured, poorly drawn, bad proportions, blurry, low quality, text, watermark, signature, human, person, people"
        }
      });
      
      if (error) {
        console.error("Edge function error:", error);
        throw new Error("Cloud AI generation failed");
      }
      
      if (data?.success && data?.image) {
        toast.success(`${mode === 'naughty' ? 'Naughty' : 'Nasty'} teddy ready!`, {
          description: `Your ${card.rarity.toLowerCase()} ${card.name} is feeling ${mode}!`
        });
        
        // Try to update the card in the database if it has an ID
        if (card.id) {
          updateCardImage(card.id, data.image)
            .catch(err => console.error("Failed to update card image in database:", err));
        }
        
        return data.image;
      } else {
        throw new Error("No image generated");
      }
    } catch (aiError) {
      console.log("AI generation failed, falling back to static assets", aiError);
      
      // Simulate a short delay for "generation"
      await new Promise(resolve => setTimeout(resolve, 800));
      
      // Get the appropriate image collection for this card's rarity
      const rarityImages = cardImages[card.rarity as keyof typeof cardImages] || cardImages.Common;
      const modeImages = rarityImages[mode];
      
      // Select a random image from the collection
      const imageUrl = modeImages[Math.floor(Math.random() * modeImages.length)];
      
      toast.success(`${mode === 'naughty' ? 'Naughty' : 'Nasty'} teddy ready!`, {
        description: `Your ${card.rarity.toLowerCase()} ${card.name} is feeling ${mode}!`
      });
      
      return imageUrl;
    }
  } catch (error) {
    console.error("Error generating teddy image:", error);
    toast.error("Couldn't prepare teddy image");
    
    // Return a fallback image
    return `/assets/cards/fallback/fallback_${mode}.png`;
  }
};

// Asset image collections by type
const assetImages = {
  background: [
    "/assets/backgrounds/bg1.png",
    "/assets/backgrounds/bg2.png",
    "/assets/backgrounds/bg3.png",
  ],
  gameboard: [
    "/assets/gameboards/board1.png",
    "/assets/gameboards/board2.png",
  ],
  'card-backs': [
    "/assets/card-backs/back1.png",
    "/assets/card-backs/back2.png",
    "/assets/card-backs/back3.png",
  ],
  'ui-elements': [
    "/assets/ui/elements1.png",
    "/assets/ui/elements2.png",
  ]
};

/**
 * Generate a game asset image
 */
export const generateAssetImage = async (assetType: string): Promise<string> => {
  try {
    toast.info(`Preparing ${assetType} image...`);
    
    // Try AI generation first
    try {
      let prompt = "";
      
      // Determine prompt based on asset type
      switch (assetType) {
        case 'background':
          prompt = "Fantasy battle arena with magical ambient lighting, suitable for NSFW card game, dark vibrant colors";
          break;
        case 'gameboard':
          prompt = "Fantasy game board grid with magical runes and energy flowing through grid lines, top down view, NSFW elements subtly integrated";
          break;
        case 'card-backs':
          prompt = "Ornate teddy bear card back design with naughty symbols and magical elements, dark purple and gold, NSFW";
          break;
        case 'ui-elements':
          prompt = "Fantasy game UI elements with ornate borders, buttons, and panels, dark theme with purple accents, subtle NSFW theming";
          break;
        default:
          prompt = `Fantasy ${assetType} for adult card game`;
      }
      
      const { data, error } = await supabase.functions.invoke('huggingface-image-generator', {
        body: { 
          prompt,
          type: 'regular'
        }
      });
      
      if (error) {
        throw new Error("AI generation failed");
      }
      
      if (data?.success && data?.image) {
        toast.success(`${assetType} ready!`, {
          description: `Your ${assetType} has been generated!`
        });
        
        return data.image;
      } else {
        throw new Error("No image generated");
      }
    } catch (aiError) {
      console.log("AI generation failed, falling back to static assets", aiError);
      
      // Simulate a short delay for "generation"
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const typeImages = assetImages[assetType as keyof typeof assetImages];
      
      if (!typeImages || typeImages.length === 0) {
        throw new Error(`No images available for asset type: ${assetType}`);
      }
      
      // Select a random image from the collection
      const imageUrl = typeImages[Math.floor(Math.random() * typeImages.length)];
      
      toast.success(`${assetType} ready!`, {
        description: `Your ${assetType} has been generated successfully!`
      });
      
      return imageUrl;
    }
  } catch (error) {
    console.error(`Error generating ${assetType} image:`, error);
    toast.error(`Couldn't prepare ${assetType} image`);
    
    // Return a fallback image
    return `/assets/fallback/fallback_${assetType}.png`;
  }
};
