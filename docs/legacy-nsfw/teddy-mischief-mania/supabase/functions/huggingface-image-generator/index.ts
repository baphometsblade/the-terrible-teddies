
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { HfInference } from "https://esm.sh/@huggingface/inference@2.3.2";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get the authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error("Missing authorization header");
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Verify the user is authenticated and has admin role
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      throw new Error("Invalid authorization");
    }
    
    // Check if user has admin role
    const { data: roles, error: rolesError } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id);
      
    if (rolesError) {
      throw new Error("Failed to verify user role");
    }
    
    const isAdmin = roles && roles.some(r => r.role === 'admin');
    
    if (!isAdmin) {
      throw new Error("Admin privileges required");
    }

    // Parse request body
    const { prompt, negative_prompt, type, model, seed } = await req.json();

    if (!prompt) {
      throw new Error("Prompt is required");
    }

    // Get HF token from environment
    const HUGGING_FACE_ACCESS_TOKEN = Deno.env.get("HUGGING_FACE_ACCESS_TOKEN");
    if (!HUGGING_FACE_ACCESS_TOKEN) {
      throw new Error("HUGGING_FACE_ACCESS_TOKEN is not set in environment variables");
    }

    console.log(`Generating image with prompt: "${prompt}"`);
    console.log(`Type: ${type || "naughty"}, Model: ${model || "default"}`);

    // Select model based on input or default
    let modelId = "black-forest-labs/FLUX.1-schnell"; // Default model - fast and high quality
    if (model) {
      modelId = model;
    } else {
      // Alternative models based on type
      if (type === "nasty") {
        modelId = "playgroundai/playground-v2.5-1024px-aesthetic";
      }
    }

    // Initialize Hugging Face client
    const hf = new HfInference(HUGGING_FACE_ACCESS_TOKEN);

    // Enhance the prompt based on the type
    let enhancedPrompt = prompt;
    if (type === "naughty") {
      enhancedPrompt = `fantasy teddy bear, stuffed animal, seductive pose, playful, flirty expression, cute, adult-themed, high quality, suggestive outfit, romantic setting, ${prompt}`;
    } else if (type === "nasty") {
      enhancedPrompt = `fantasy teddy bear, stuffed animal, battle-ready, aggressive pose, menacing, fierce, fantasy battle scene, torn fabric, spiky accessories, dark atmosphere, high quality, ${prompt}`;
    } else {
      enhancedPrompt = `fantasy teddy bear, stuffed animal, colorful, vibrant, magical, cute pose, high quality, ${prompt}`;
    }

    console.log(`Enhanced prompt: "${enhancedPrompt}"`);

    // Generate image
    const image = await hf.textToImage({
      inputs: enhancedPrompt,
      model: modelId,
      parameters: {
        negative_prompt: negative_prompt || "deformed, bad anatomy, disfigured, poorly drawn, bad proportions, blurry, text, watermark",
        seed: seed ? Number(seed) : undefined
      }
    });

    // Convert the blob to a base64 string
    const arrayBuffer = await image.arrayBuffer();
    const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));

    console.log("Image generation successful");

    // Save generation metadata to the database
    await supabase
      .from('image_generation_logs')
      .insert({
        user_id: user.id,
        prompt: prompt,
        enhanced_prompt: enhancedPrompt,
        model: modelId,
        type: type || 'naughty',
        generated_at: new Date().toISOString()
      });

    return new Response(
      JSON.stringify({ 
        success: true, 
        image: `data:image/png;base64,${base64}`,
        model: modelId
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error("Error generating image:", error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message || "An unexpected error occurred" 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
