
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { DEFAULT_API_URL } from "@/utils/stableDiffusionService";

export async function generateImagesForCards(onProgress?: (progress: number) => void) {
  try {
    // Get all cards without images
    const { data: cards, error: cardsError } = await supabase
      .from('cards')
      .select('id, name, description, attack, defense, fluff, special_move, rarity')
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
    
    console.log(`Found ${cards.length} cards without images`);
    
    // Process cards in batches to avoid rate limits
    const batchSize = 1; // Reduced batch size to prevent overload
    const results = [];
    
    // Try to connect to the local Stable Diffusion API
    const sdApiUrl = DEFAULT_API_URL;
    
    try {
      // Check if the SD API is available
      const testResponse = await fetch(`${sdApiUrl}/sdapi/v1/samplers`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });
      
      if (!testResponse.ok) {
        throw new Error(`Stable Diffusion API not available at ${sdApiUrl}`);
      }
      
      console.log("Stable Diffusion API is available, using for image generation");
    } catch (apiError) {
      console.error("Error connecting to Stable Diffusion API:", apiError);
      toast.error("Cannot connect to Stable Diffusion API", {
        description: "Will try to use edge function instead"
      });
    }
    
    for (let i = 0; i < cards.length; i += batchSize) {
      const batch = cards.slice(i, i + batchSize);
      const currentBatch = Math.floor(i / batchSize) + 1;
      const totalBatches = Math.ceil(cards.length / batchSize);
      
      // Calculate and report progress
      const progress = (i / cards.length) * 100;
      onProgress?.(progress);
      
      toast(`Processing batch ${currentBatch}/${totalBatches}`, {
        description: `Generating images for ${batch.map(c => c.name).join(", ")}`
      });
      
      // Process batch sequentially to avoid overwhelming the API
      for (const card of batch) {
        try {
          toast(`Generating image for ${card.name}...`, {
            id: `generation-${card.id}`
          });

          let imageUrl = null;
          
          // Try using direct SD API first, then fall back to edge function
          try {
            imageUrl = await generateWithStableDiffusion(card);
          } catch (sdError) {
            console.error("Error using direct Stable Diffusion API:", sdError);
            console.log("Falling back to edge function...");
            
            // Fall back to edge function if direct API fails
            const response = await supabase.functions.invoke('generate-teddy-image', {
              body: { 
                cardId: card.id.toString(),
                cardData: {
                  name: card.name,
                  description: card.description || "",
                  attack: card.attack || 0,
                  defense: card.defense || 0,
                  fluff: card.fluff || 0,
                  specialMove: card.special_move || "",
                  rarity: card.rarity || "Common"
                }
              }
            });

            if (response.error) throw response.error;
            imageUrl = response.data.url;
          }

          if (!imageUrl) {
            throw new Error("Failed to generate image");
          }

          // Update the card with the new image URL
          const { error: updateError } = await supabase
            .from('cards')
            .update({ image_url: imageUrl })
            .eq('id', card.id);

          if (updateError) throw updateError;

          toast(`Generated image for ${card.name}`, {
            id: `generation-${card.id}`,
            description: `Card image successfully created and saved to database`
          });

          results.push({
            id: card.id,
            name: card.name,
            success: true,
            message: 'Image generated and integrated successfully',
            imageUrl: imageUrl
          });
        } catch (error) {
          console.error(`Error generating image for ${card.name}:`, error);
          
          toast.error(`Failed to generate image for ${card.name}`, {
            id: `generation-${card.id}`,
            description: error.message || 'Unknown error occurred'
          });

          results.push({
            id: card.id,
            name: card.name,
            success: false,
            message: error.message || 'Failed to generate image',
            error: error
          });
        }

        // Add delay between individual card processing
        if (i + 1 < cards.length) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      // Add delay between batches
      if (i + batchSize < cards.length) {
        toast(`Batch ${currentBatch} complete`, {
          description: `Waiting before processing next batch...`
        });
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
    }

    // Set final progress
    onProgress?.(100);

    const successCount = results.filter(r => r.success).length;
    
    toast(`Image generation complete`, {
      description: `Successfully generated ${successCount} out of ${cards.length} images`
    });

    return { results, totalCards: cards.length };
  } catch (error) {
    console.error('Error in generateImagesForCards:', error);
    
    toast.error(`Generation process failed`, {
      description: error.message || 'An unexpected error occurred'
    });
    
    throw error;
  }
}

// Generate image using direct Stable Diffusion API
async function generateWithStableDiffusion(card: any): Promise<string> {
  try {
    const sdApiUrl = DEFAULT_API_URL;
    
    // Create a prompt based on the card's properties
    const isNaughty = card.special_move?.toLowerCase().includes("seduct") || card.fluff > card.attack;
    const isNasty = card.special_move?.toLowerCase().includes("brutal") || card.attack > card.defense;
    
    let basePrompt = "teddy bear, stuffed animal, plush toy, ";
    
    if (isNaughty) {
      basePrompt += "flirty, cute, romantic pose, ";
    } else if (isNasty) {
      basePrompt += "battle-damaged, aggressive, fierce, ";
    }
    
    if (card.rarity === "Legendary" || card.rarity === "Epic") {
      basePrompt += "high quality, detailed, ornate accessories, vibrant, ";
    }
    
    basePrompt += `${card.name}, ${card.description || ""}`;
    
    // Configure the API call
    const params = {
      prompt: basePrompt,
      negative_prompt: "deformed, bad anatomy, disfigured, poorly drawn, bad proportions, blurry, extra limbs, missing limbs, text, watermark",
      steps: card.rarity === "Legendary" ? 40 : card.rarity === "Epic" ? 30 : 20,
      width: 512,
      height: 768,
      cfg_scale: card.rarity === "Legendary" ? 9 : card.rarity === "Epic" ? 8 : 7,
      sampler_name: "DPM++ 2M Karras",
      seed: -1
    };
    
    console.log("Calling Stable Diffusion API with params:", params);
    
    // Call the Stable Diffusion API
    const response = await fetch(`${sdApiUrl}/sdapi/v1/txt2img`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params)
    });
    
    if (!response.ok) {
      throw new Error(`Stable Diffusion API error: ${response.status} ${response.statusText}`);
    }
    
    const result = await response.json();
    
    if (!result.images || result.images.length === 0) {
      throw new Error("No images returned from Stable Diffusion API");
    }
    
    // Convert base64 to a Blob
    const imageBase64 = result.images[0];
    const byteCharacters = atob(imageBase64);
    const byteArrays = [];
    
    for (let i = 0; i < byteCharacters.length; i += 512) {
      const slice = byteCharacters.slice(i, i + 512);
      const byteNumbers = new Array(slice.length);
      
      for (let j = 0; j < slice.length; j++) {
        byteNumbers[j] = slice.charCodeAt(j);
      }
      
      const byteArray = new Uint8Array(byteNumbers);
      byteArrays.push(byteArray);
    }
    
    const blob = new Blob(byteArrays, { type: "image/png" });
    
    // Upload to Supabase Storage
    const fileName = `teddy_${card.id}_${Date.now()}.png`;
    
    const { data, error } = await supabase.storage
      .from("teddy-images")
      .upload(fileName, blob, {
        contentType: "image/png",
        upsert: false
      });
      
    if (error) throw error;
    
    // Get the public URL
    const { data: { publicUrl } } = supabase.storage
      .from("teddy-images")
      .getPublicUrl(fileName);
      
    return publicUrl;
  } catch (error) {
    console.error("Error in generateWithStableDiffusion:", error);
    throw error;
  }
}
