import { toast } from "sonner";
import { DEFAULT_API_URL } from "./apiClient";
import { StableDiffusionGenerationOptions, StableDiffusionResult } from "@/components/AdminTools/StableDiffusionConnector/types";
import { getParametersForAssetType } from "./imageOptions";
import { supabase } from "@/integrations/supabase/client";

/**
 * Generate an image using Stable Diffusion API or cloud fallback
 */
export async function generateImage(
  prompt: string,
  options: {
    negative_prompt?: string;
    steps?: number;
    width?: number;
    height?: number;
    cfg_scale?: number;
    sampler_name?: string;
    seed?: number;
  } = {},
  apiUrl: string = DEFAULT_API_URL
): Promise<StableDiffusionResult | null> {
  try {
    console.log(`Generating image with prompt: "${prompt}"`);
    
    // Try local Stable Diffusion first with a short timeout
    try {
      const testResponse = await fetch(`${apiUrl}/samplers`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(2000) // Short 2-second timeout for quick detection
      });
      
      if (testResponse.ok) {
        return await generateWithLocalStableDiffusion(prompt, options, apiUrl);
      } else {
        console.log("Local Stable Diffusion not available, falling back to cloud services");
        return await generateWithCloudService(prompt, options);
      }
    } catch (connError) {
      console.log("Local connection failed, using cloud fallback", connError);
      return await generateWithCloudService(prompt, options);
    }
  } catch (err) {
    console.error("Image generation error:", err);
    toast.error("Failed to generate image", {
      description: err instanceof Error ? err.message : "Check console for details"
    });
    return null;
  }
}

/**
 * Generate image using local Stable Diffusion
 */
async function generateWithLocalStableDiffusion(
  prompt: string,
  options: any,
  apiUrl: string
): Promise<StableDiffusionResult | null> {
  console.log("Generating with local Stable Diffusion at", apiUrl);
  
  const payload = {
    prompt: prompt,
    negative_prompt: options.negative_prompt || "deformed, ugly, bad anatomy",
    steps: options.steps || 30,
    width: options.width || 512,
    height: options.height || 768,
    cfg_scale: options.cfg_scale || 7.5,
    sampler_name: options.sampler_name || "DPM++ 2M Karras",
    seed: options.seed || -1
  };
  
  console.log("Generation parameters:", payload);
  
  const response = await fetch(`${apiUrl}/txt2img`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(60000) // 60 second timeout for image generation
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`API Error (${response.status}): ${errorText}`);
  }
  
  const data = await response.json();
  
  if (!data.images || data.images.length === 0) {
    throw new Error("No images returned from Stable Diffusion API");
  }
  
  // The first image in base64 format
  const image = `data:image/png;base64,${data.images[0]}`;
  console.log("Image generated successfully with local Stable Diffusion!");
  
  return {
    image,
    parameters: data.parameters || payload,
    info: data.parameters || payload
  };
}

/**
 * Generate image using cloud fallback service
 */
async function generateWithCloudService(
  prompt: string,
  options: any
): Promise<StableDiffusionResult | null> {
  console.log("Generating with cloud fallback service...");
  toast.info("Using cloud service for image generation", {
    description: "Local Stable Diffusion not available"
  });
  
  try {
    // First try the primary edge function
    try {
      // Call the edge function to generate the image
      const { data, error } = await supabase.functions.invoke('generate-teddy-image', {
        body: { 
          cardData: {
            name: "Teddy image",
            description: prompt,
            rarity: options.quality || "Rare",
            attack: 5,
            defense: 5,
            fluff: 5,
            specialMove: options.negative_prompt || "Naughty move",
            id: Date.now().toString()
          }
        }
      });
      
      if (error) {
        console.error("Edge function error:", error);
        throw new Error(`Edge function error: ${error.message}`);
      }
      
      if (!data?.url) {
        throw new Error("No image URL returned from edge function");
      }
      
      console.log("Image generated successfully with cloud service!");
      
      // Use a placeholder for the parameters and info
      const placeholderParams = {
        prompt: prompt,
        negative_prompt: options.negative_prompt || "deformed, ugly, bad anatomy",
        steps: options.steps || 30,
        width: options.width || 512,
        height: options.height || 768,
        cfg_scale: options.cfg_scale || 7.5,
        sampler_name: "Cloud Service",
        seed: -1,
        model: "Cloud Fallback Model"
      };
      
      return {
        image: data.url,
        parameters: placeholderParams,
        info: placeholderParams
      };
    } catch (primaryError) {
      console.error("Primary cloud generation failed:", primaryError);
      
      // Try replicate as a fallback
      try {
        console.log("Trying Replicate fallback...");
        
        const { data, error } = await supabase.functions.invoke('replicate-image-generator', {
          body: { 
            assetType: 'teddy-images',
            prompt: prompt
          }
        });
        
        if (error) {
          throw new Error(`Replicate fallback error: ${error.message}`);
        }
        
        if (!data?.url) {
          throw new Error("No image URL returned from Replicate");
        }
        
        console.log("Image generated successfully with Replicate!");
        
        const placeholderParams = {
          prompt: prompt,
          negative_prompt: options.negative_prompt || "deformed, ugly, bad anatomy",
          steps: 30,
          width: 512,
          height: 768,
          cfg_scale: 7.0,
          sampler_name: "Replicate API",
          seed: -1,
          model: "stability-ai/stable-diffusion"
        };
        
        return {
          image: data.url,
          parameters: placeholderParams,
          info: placeholderParams
        };
      } catch (replicateError) {
        console.error("Replicate fallback failed:", replicateError);
        
        // As a final fallback, try Hugging Face
        try {
          console.log("Trying Hugging Face fallback...");
          
          const { data, error } = await supabase.functions.invoke('huggingface-image-generator', {
            body: { 
              prompt: prompt
            }
          });
          
          if (error || !data?.image) {
            throw new Error("Hugging Face generation failed");
          }
          
          console.log("Image generated successfully with Hugging Face!");
          
          const placeholderParams = {
            prompt: prompt,
            negative_prompt: options.negative_prompt || "deformed, ugly, bad anatomy",
            steps: 20,
            width: 512,
            height: 512,
            cfg_scale: 7.0,
            sampler_name: "Hugging Face API",
            seed: -1,
            model: "Hugging Face Model"
          };
          
          return {
            image: data.image,
            parameters: placeholderParams,
            info: placeholderParams
          };
        } catch (hfError) {
          console.error("All fallbacks failed - cannot generate image");
          throw primaryError; // Throw the original error
        }
      }
    }
  } catch (error) {
    console.error("Cloud generation error:", error);
    throw error;
  }
}

/**
 * Generate a game asset image with optimized settings
 */
export async function generateAssetImage(
  prompt: string,
  assetType: string,
  apiUrl: string = DEFAULT_API_URL
): Promise<string | null> {
  try {
    // Get optimized parameters for the asset type
    const params = getParametersForAssetType(assetType, prompt);
    
    // Try local Stable Diffusion first with a short timeout
    try {
      const testResponse = await fetch(`${apiUrl}/samplers`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(2000) // Short 2-second timeout for quick detection
      });
      
      if (testResponse.ok) {
        // Local Stable Diffusion is available
        const result = await generateImage(
          params.prompt,
          {
            steps: params.steps,
            width: params.width,
            height: params.height,
            cfg_scale: params.cfg_scale,
            sampler_name: params.sampler_name,
            negative_prompt: params.negative_prompt
          },
          apiUrl
        );
        
        return result?.image || null;
      } else {
        // Fall back to cloud service
        console.log(`Local connection failed for ${assetType}, using cloud fallback`);
        return await generateAssetWithCloudService(params.prompt, assetType);
      }
    } catch (connError) {
      console.log(`Local connection error for ${assetType}, using cloud fallback`, connError);
      return await generateAssetWithCloudService(params.prompt, assetType);
    }
  } catch (error) {
    console.error(`Error generating ${assetType} image:`, error);
    toast.error(`Failed to generate ${assetType}`, {
      description: "Check the server connection and try again"
    });
    return null;
  }
}

/**
 * Generate asset using cloud service
 */
async function generateAssetWithCloudService(prompt: string, assetType: string): Promise<string | null> {
  try {
    console.log(`Generating ${assetType} with cloud service...`);
    toast.info(`Using cloud service for ${assetType} generation`, {
      description: "Local Stable Diffusion not available"
    });
    
    // Call the edge function to generate the asset
    const { data, error } = await supabase.functions.invoke('generate-game-assets', {
      body: { 
        assetType, 
        prompt 
      }
    });
    
    if (error) {
      console.error("Edge function error:", error);
      throw new Error(`Edge function error: ${error.message}`);
    }
    
    if (!data?.url) {
      throw new Error("No image URL returned from edge function");
    }
    
    console.log(`${assetType} generated successfully with cloud service!`);
    return data.url;
  } catch (error) {
    console.error(`Cloud generation error for ${assetType}:`, error);
    
    // Try fallback to Replicate API
    try {
      console.log("Trying Replicate fallback...");
      
      const { data, error } = await supabase.functions.invoke('replicate-image-generator', {
        body: { 
          assetType,
          prompt
        }
      });
      
      if (error) {
        throw new Error(`Replicate fallback error: ${error.message}`);
      }
      
      if (!data?.url) {
        throw new Error("No image URL returned from Replicate");
      }
      
      console.log(`${assetType} generated successfully with Replicate!`);
      return data.url;
    } catch (replicateError) {
      console.error("Replicate fallback failed:", replicateError);
      throw error; // Throw the original error
    }
  }
}
