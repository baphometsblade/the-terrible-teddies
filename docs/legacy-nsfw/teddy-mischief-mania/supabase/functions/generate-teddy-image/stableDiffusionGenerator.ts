
import { corsHeaders } from "./_shared/cors.ts";

// Generate image using local Stable Diffusion API
export async function generateWithStableDiffusion(prompt: string, cardData: any, supabase: any) {
  // Update URL to match your running instance
  const sdApiUrl = Deno.env.get("STABLE_DIFFUSION_API_URL") || "http://127.0.0.1:7860";
  
  console.log(`Using Stable Diffusion API at ${sdApiUrl}`);
  
  try {
    // Determine if this is a naughty or nasty card type based on stats/specialMove
    const isNaughty = cardData.specialMove?.toLowerCase().includes("seduct") || 
                     cardData.fluff > cardData.attack;
    const isNasty = cardData.specialMove?.toLowerCase().includes("brutal") || 
                   cardData.attack > cardData.defense;
                   
    // Create a negative prompt based on what we don't want
    const negativePrompt = "deformed, bad anatomy, disfigured, poorly drawn, bad proportions, blurry, duplicate, extra limbs, missing limbs, text, watermark, signature";
    
    // Set up parameters based on card rarity
    const steps = cardData.rarity === "Legendary" ? 40 : 
                  cardData.rarity === "Epic" ? 30 : 
                  cardData.rarity === "Rare" ? 25 : 20;
                  
    const cfgScale = cardData.rarity === "Legendary" ? 9 : 
                    cardData.rarity === "Epic" ? 8 : 7;
                    
    // Call the Stable Diffusion API
    const response = await fetch(`${sdApiUrl}/sdapi/v1/txt2img`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        prompt: prompt,
        negative_prompt: negativePrompt,
        steps: steps,
        width: 512,
        height: 768,  // Card portrait format
        cfg_scale: cfgScale,
        sampler_name: "DPM++ 2M Karras",
        seed: -1  // Random seed
      }),
    });
    
    if (!response.ok) {
      const error = await response.text();
      console.error("Stable Diffusion API error:", error);
      throw new Error(`Stable Diffusion API error: ${error}`);
    }
    
    const data = await response.json();
    
    if (!data.images || data.images.length === 0) {
      throw new Error("No images returned from Stable Diffusion API");
    }
    
    // Convert the base64 image to a blob
    const imageBlob = base64ToBlob(data.images[0], "image/png");
    
    // Upload the image to Supabase Storage
    const fileName = `teddy_${cardData.id || Date.now()}_${Math.floor(Math.random() * 1000)}.png`;
    
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from("teddy-images")
      .upload(fileName, imageBlob, {
        contentType: "image/png",
        upsert: false,
      });
    
    if (uploadError) {
      console.error("Supabase Storage error:", uploadError);
      throw new Error(`Supabase Storage error: ${uploadError.message}`);
    }
    
    // Get the public URL
    const { data: publicUrlData } = supabase.storage
      .from("teddy-images")
      .getPublicUrl(fileName);
      
    // Save image metadata to database
    await saveImageMetadata(supabase, fileName, prompt, cardData.id);
    
    return publicUrlData.publicUrl;
  } catch (error) {
    console.error("Error in generateWithStableDiffusion:", error);
    throw error;
  }
}

// Save metadata about the generated image to the database
async function saveImageMetadata(supabase: any, storagePath: string, prompt: string, cardId: string | undefined) {
  try {
    const { data, error } = await supabase
      .from("image_metadata")
      .insert({
        storage_path: storagePath,
        prompt: prompt,
        card_id: cardId,
        analysis: "Generated teddy bear image"
      });
      
    if (error) {
      console.error("Error saving image metadata:", error);
    } else {
      console.log("Image metadata saved successfully", data);
    }
  } catch (err) {
    console.error("Exception saving image metadata:", err);
  }
}

// Helper function to convert base64 to blob
function base64ToBlob(base64: string, contentType: string) {
  const byteCharacters = atob(base64);
  const byteArrays = [];
  
  for (let offset = 0; offset < byteCharacters.length; offset += 512) {
    const slice = byteCharacters.slice(offset, offset + 512);
    
    const byteNumbers = new Array(slice.length);
    for (let i = 0; i < slice.length; i++) {
      byteNumbers[i] = slice.charCodeAt(i);
    }
    
    const byteArray = new Uint8Array(byteNumbers);
    byteArrays.push(byteArray);
  }
  
  return new Blob(byteArrays, { type: contentType });
}
