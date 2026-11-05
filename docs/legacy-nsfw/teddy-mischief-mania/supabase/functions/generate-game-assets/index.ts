
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { generateWithStableDiffusion } from "./stableDiffusionGenerator.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { assetType, prompt } = await req.json();
    
    if (!assetType) {
      return new Response(
        JSON.stringify({ error: 'Asset type is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate asset type
    const validAssetTypes = ['backgrounds', 'game-boards', 'card-backs', 'ui-elements'];
    if (!validAssetTypes.includes(assetType)) {
      return new Response(
        JSON.stringify({ error: `Invalid asset type. Must be one of: ${validAssetTypes.join(', ')}` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Generating ${assetType} with prompt: ${prompt}`);

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Default prompts if none provided
    const defaultPrompts = {
      'backgrounds': 'Fantasy battle arena with magical ambient lighting, suitable for card game, dark vibrant colors',
      'game-boards': 'Fantasy game board grid with magical runes and energy flowing through grid lines, top down view',
      'card-backs': 'Ornate teddy bear card back design with naughty symbols and magical elements, dark purple and gold',
      'ui-elements': 'Fantasy game UI elements with ornate borders, buttons, and panels, dark theme with purple accents'
    };

    const finalPrompt = prompt || defaultPrompts[assetType as keyof typeof defaultPrompts];
    
    // Generate image using Stable Diffusion
    const imageResult = await generateWithStableDiffusion(
      finalPrompt, 
      assetType, 
      supabase
    );
    
    if (!imageResult || !imageResult.imageUrl) {
      return new Response(
        JSON.stringify({ error: 'Failed to generate image with Stable Diffusion' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const imageUrl = imageResult.imageUrl;
    const imageBlob = imageResult.imageBlob;

    // Create storage bucket if it doesn't exist
    const { data: buckets } = await supabase.storage.listBuckets();
    if (!buckets?.find(bucket => bucket.name === 'game-assets')) {
      console.log("Creating game-assets bucket...");
      await supabase.storage.createBucket('game-assets', {
        public: true
      });
    }

    // Upload to Supabase Storage
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `${assetType}_${timestamp}.png`;
    
    console.log(`Uploading image to game-assets/${assetType}/${filename}...`);
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('game-assets')
      .upload(`${assetType}/${filename}`, imageBlob, {
        contentType: 'image/png',
        upsert: false
      });

    if (uploadError) {
      console.error("Upload error:", uploadError);
      return new Response(
        JSON.stringify({ error: 'Failed to upload image to storage', details: uploadError }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from('game-assets')
      .getPublicUrl(`${assetType}/${filename}`);

    // Store asset in game_assets table
    const { error: dbError } = await supabase
      .from('game_assets')
      .insert({
        asset_type: assetType,
        url: publicUrl,
        prompt: finalPrompt,
        is_active: true
      });

    if (dbError) {
      console.error("Database error:", dbError);
      return new Response(
        JSON.stringify({ 
          warning: 'Asset uploaded but failed to save metadata to database', 
          url: publicUrl, 
          details: dbError 
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log("Asset generation complete:", publicUrl);
    return new Response(
      JSON.stringify({ success: true, url: publicUrl }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error("Error in generate-game-assets function:", error);
    return new Response(
      JSON.stringify({ error: error.message || 'An unknown error occurred' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
