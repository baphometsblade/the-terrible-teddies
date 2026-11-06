
import { TeddyCard, GameMode } from "@/lib/types";
import { toast } from "sonner";
import { generateImage } from "./imageGenerator";

// Asset type definitions
export type AssetType = 'background' | 'gameboard' | 'card-backs' | 'ui-elements';

/**
 * Generate teddy card image with Stable Diffusion
 */
export async function generateTeddyCardImage(
  card: TeddyCard, 
  gameMode: GameMode,
  url?: string
): Promise<string | null> {
  try {
    const prompt = getCardPrompt(card, gameMode);
    
    console.log(`Generating image for ${card.name} in ${gameMode} mode`);
    
    const result = await generateImage(
      prompt, 
      {
        steps: 30,
        width: 512,
        height: 768,
        cfg_scale: 8,
        sampler_name: "DPM++ 2M Karras",
        negative_prompt: "deformed, bad anatomy, disfigured, poorly drawn, bad proportions, blurry, duplicate, extra limbs, missing limbs, text, watermark"
      },
      url
    );
    
    if (!result) {
      throw new Error("Failed to generate card image");
    }
    
    toast.success(`Generated image for ${card.name}`, {
      description: `Card image created for ${gameMode} mode`
    });
    
    return result.image;
  } catch (error) {
    console.error("Error generating teddy card image:", error);
    toast.error(`Failed to generate image for ${card.name}`, {
      description: error instanceof Error ? error.message : "Unknown error"
    });
    return null;
  }
}

/**
 * Generate game asset with Stable Diffusion
 */
export async function generateGameAsset(
  assetType: AssetType,
  url?: string
): Promise<string | null> {
  try {
    const prompt = getAssetPrompt(assetType);
    
    console.log(`Generating game asset: ${assetType}`);
    
    // Configure options based on asset type
    const options = getOptionsForAssetType(assetType);
    
    const result = await generateImage(prompt, options, url);
    
    if (!result) {
      throw new Error(`Failed to generate ${assetType} image`);
    }
    
    toast.success(`Generated ${assetType}`, {
      description: `Your new ${assetType} is ready!`
    });
    
    return result.image;
  } catch (error) {
    console.error(`Error generating ${assetType}:`, error);
    toast.error(`Failed to generate ${assetType}`, {
      description: error instanceof Error ? error.message : "Unknown error"
    });
    return null;
  }
}

// Helper function to get options based on asset type
function getOptionsForAssetType(assetType: AssetType) {
  const baseOptions = {
    steps: 40,
    cfg_scale: 7.5,
    sampler_name: "DPM++ SDE Karras",
    negative_prompt: "deformed, bad anatomy, disfigured, poorly drawn, bad proportions, blurry, text, watermark, signature"
  };
  
  switch (assetType) {
    case 'background':
      return {
        ...baseOptions,
        width: 1024,
        height: 768,
      };
    case 'gameboard':
      return {
        ...baseOptions,
        width: 1024,
        height: 1024,
        sampler_name: "Euler a",
      };
    case 'card-backs':
      return {
        ...baseOptions,
        width: 512,
        height: 768,
        steps: 30,
        cfg_scale: 8,
        sampler_name: "DPM++ 2M Karras",
      };
    case 'ui-elements':
      return {
        ...baseOptions,
        width: 768,
        height: 768,
        steps: 30,
      };
    default:
      return {
        ...baseOptions,
        width: 1024,
        height: 1024,
      };
  }
}

// Helper functions for creating prompts
function getCardPrompt(card: TeddyCard, mode: GameMode): string {
  const basePrompt = mode === 'naughty' 
    ? "Cute teddy bear with suggestive pose, flirty expression, playful"
    : "Battle-damaged teddy bear with aggressive pose, fierce expression";
    
  let rarityModifier = "";
  
  switch (card.rarity) {
    case "Legendary":
      rarityModifier = mode === 'naughty' 
        ? "luxurious costume, ornate accessories, vibrant colors, extraordinary detail" 
        : "epic battle gear, legendary weapons, battle scars, intimidating presence";
      break;
    case "Epic":
      rarityModifier = mode === 'naughty' 
        ? "elegant outfit, special accessories, vibrant" 
        : "impressive armor, battle trophies, imposing";
      break;
    case "Rare":
      rarityModifier = mode === 'naughty' 
        ? "attractive outfit, nice accessories" 
        : "battle armor, weapons, aggressive";
      break;
    default:
      rarityModifier = mode === 'naughty' 
        ? "simple outfit, cute" 
        : "basic armor, determined";
  }
  
  const statsPrompt = card.attack > card.defense 
    ? "powerful, strong, dominant" 
    : "resilient, enduring, sturdy";
    
  return `${basePrompt}, ${rarityModifier}, ${statsPrompt}, ${card.name}, ${card.description || ""}`;
}

function getAssetPrompt(assetType: AssetType): string {
  switch (assetType) {
    case 'background':
      return "Fantasy battle arena with magical ambient lighting, suitable for card game, dark vibrant colors, romantic fantasy atmosphere, detailed";
    case 'gameboard':
      return "Fantasy game board grid with magical runes and energy flowing through grid lines, top down view, dark romantic theme, detailed";
    case 'card-backs':
      return "Ornate teddy bear card back design with naughty symbols and magical elements, dark purple and gold, romantic fantasy style, detailed";
    case 'ui-elements':
      return "Fantasy game UI elements with ornate borders, buttons, and panels, dark theme with purple accents, romantic and playful design, detailed";
    default:
      return "Fantasy card game asset with magical elements, detailed fantasy artwork";
  }
}
