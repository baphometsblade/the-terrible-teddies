
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { TeddyCard } from "@/lib/types";
import { generatePromptForCard } from "./promptUtils";

/**
 * Generate an NSFW teddy image using Hugging Face
 */
export const generateNSFWTeddyImage = async (
  card: TeddyCard,
  mode: 'naughty' | 'nasty' = 'naughty'
): Promise<string | null> => {
  try {
    const prompt = generatePromptForCard(card);
    
    toast.info(`Generating ${mode} teddy image for ${card.name}...`, {
      description: "Our AI is crafting a naughty teddy for you"
    });
    
    const { data, error } = await supabase.functions.invoke(
      'huggingface-image-generator',
      {
        body: {
          prompt,
          type: mode,
          negative_prompt: "deformed, bad anatomy, disfigured, poorly drawn, bad proportions, blurry, low quality, text, watermark, signature, human, person, people"
        }
      }
    );
    
    if (error) {
      throw new Error(`Failed to generate image: ${error.message}`);
    }
    
    if (!data?.success || !data?.image) {
      throw new Error("No image was returned from the generator");
    }
    
    toast.success(`${mode === 'naughty' ? 'Naughty' : 'Nasty'} teddy ready!`, {
      description: `Your ${card.rarity.toLowerCase()} ${card.name} is feeling ${mode === 'naughty' ? 'frisky' : 'fierce'}!`
    });
    
    return data.image;
  } catch (error) {
    console.error(`Error generating ${mode} teddy image:`, error);
    toast.error(`Failed to generate ${mode} teddy image`, {
      description: error instanceof Error ? error.message : "Unknown error"
    });
    return null;
  }
};

/**
 * Generate a NSFW game asset using Hugging Face
 */
export const generateNSFWGameAsset = async (
  assetType: string,
  description: string = ""
): Promise<string | null> => {
  try {
    // Determine prompt based on asset type
    let prompt = "";
    switch (assetType) {
      case 'background':
      case 'backgrounds':
        prompt = "Fantasy battle arena with magical ambient lighting, suitable for NSFW card game, dark vibrant colors";
        break;
      case 'gameboard':
      case 'gameboards':
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
    
    // Add custom description if provided
    if (description) {
      prompt += `, ${description}`;
    }
    
    toast.info(`Generating ${assetType} image...`, {
      description: "Our AI is crafting a game asset for you"
    });
    
    const { data, error } = await supabase.functions.invoke(
      'huggingface-image-generator',
      {
        body: {
          prompt,
          type: 'regular',
          negative_prompt: "deformed, bad anatomy, disfigured, poorly drawn, bad proportions, blurry, low quality, text, watermark, signature, human, person, people"
        }
      }
    );
    
    if (error) {
      throw new Error(`Failed to generate image: ${error.message}`);
    }
    
    if (!data?.success || !data?.image) {
      throw new Error("No image was returned from the generator");
    }
    
    toast.success(`${assetType} asset ready!`, {
      description: `Your ${assetType} has been generated successfully!`
    });
    
    return data.image;
  } catch (error) {
    console.error(`Error generating ${assetType} image:`, error);
    toast.error(`Failed to generate ${assetType} image`, {
      description: error instanceof Error ? error.message : "Unknown error"
    });
    return null;
  }
};
