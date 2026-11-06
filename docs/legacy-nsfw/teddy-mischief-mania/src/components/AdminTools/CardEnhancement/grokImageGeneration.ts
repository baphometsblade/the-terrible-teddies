
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ImageGenerationResult } from "./types";
import { generatePromptForCard } from "@/utils/imageGeneration/promptUtils";
import { updateCardImage } from "@/utils/imageGeneration/supabaseUtils";
import { TeddyCard } from "@/lib/types";

export const generateImagesForCards = async (
  onProgress?: (progress: number) => void
): Promise<{ results: ImageGenerationResult[]; totalCards: number }> => {
  try {
    const { data: cards, error: cardsError } = await supabase
      .from('cards')
      .select('id, name, description, attack, defense, fluff, special_move, rarity, image_url')
      .is('image_url', null)
      .eq('card_type', 'teddy');

    if (cardsError) throw cardsError;

    if (!cards?.length) {
      toast("No cards need images", {
        description: "All cards already have images assigned."
      });
      return { results: [], totalCards: 0 };
    }

    toast(`Starting image generation`, {
      description: `Found ${cards.length} cards without images. Beginning generation process...`
    });

    const results: ImageGenerationResult[] = [];
    
    for (let i = 0; i < cards.length; i++) {
      const dbCard = cards[i];
      const progress = (i / cards.length) * 100;
      onProgress?.(progress);

      try {
        // Map database fields to TeddyCard type
        const card: TeddyCard = {
          id: dbCard.id,
          name: dbCard.name,
          description: dbCard.description || "",
          image: dbCard.image_url || "",
          attack: dbCard.attack || 0,
          defense: dbCard.defense || 0,
          fluff: dbCard.fluff || 0,
          specialMove: dbCard.special_move || "",
          rarity: dbCard.rarity as TeddyCard["rarity"],
        };

        const prompt = generatePromptForCard(card);
        
        // Try to use HuggingFace generator
        const { data: hfResponse, error: hfError } = await supabase.functions.invoke(
          'huggingface-image-generator',
          {
            body: { 
              prompt,
              type: card.attack > card.defense ? 'nasty' : 'naughty'
            }
          }
        );

        if (hfError) throw hfError;
        
        if (!hfResponse?.success || !hfResponse?.image) {
          throw new Error("No image generated from HuggingFace");
        }

        await updateCardImage(card.id, hfResponse.image);

        results.push({
          id: card.id,
          name: card.name,
          success: true,
          type: 'image',
          imageUrl: hfResponse.image
        });

        toast.success(`Generated image for ${card.name}`, {
          description: "Your new naughty teddy is ready to play!"
        });
      } catch (error) {
        console.error(`Error generating image for ${dbCard.name}:`, error);
        results.push({
          id: dbCard.id,
          name: dbCard.name,
          success: false,
          type: 'image',
          error: error.message || 'Failed to generate image'
        });
        toast.error(`Failed to generate image for ${dbCard.name}`);
      }

      if (i + 1 < cards.length) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    onProgress?.(100);
    return { results, totalCards: cards.length };
  } catch (error) {
    console.error('Error in generateImagesForCards:', error);
    throw error;
  }
};
