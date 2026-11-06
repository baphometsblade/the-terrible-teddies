
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";
import Replicate from "https://esm.sh/replicate@0.25.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Parse request body
    const { assetType, prompt } = await req.json();
    console.log(`Generating ${assetType} with prompt: ${prompt}`);

    // Validate asset type
    const validAssetTypes = ['backgrounds', 'game-boards', 'card-backs', 'ui-elements'];
    if (!validAssetTypes.includes(assetType)) {
      return new Response(
        JSON.stringify({ error: `Invalid asset type. Must be one of: ${validAssetTypes.join(', ')}` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

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

    // Get Replicate API key from env
    const replicateApiKey = Deno.env.get('REPLICATE_API_KEY');
    if (!replicateApiKey) {
      return new Response(
        JSON.stringify({ error: 'Replicate API key not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Initialize Replicate client
    const replicate = new Replicate({
      auth: replicateApiKey,
    });

    console.log("Generating image with Replicate...");

    // Generate image using Replicate (Stable Diffusion)
    const output = await replicate.run(
      "stability-ai/stable-diffusion:db21e45d3f7023abc2a46ee38a23973f6dce16bb082a930b0c49861f96d1e5bf",
      {
        input: {
          prompt: finalPrompt,
          image_dimensions: "1024x1024",
          num_outputs: 1,
          scheduler: "K_EULER_ANCESTRAL",
          num_inference_steps: 50,
          guidance_scale: 7.5
        }
      }
    );

    // Error if no images generated
    if (!output || !output.length) {
      return new Response(
        JSON.stringify({ error: 'No image URL returned from Replicate' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get the image URL
    const imageUrl = output[0];
    console.log("Image generated successfully:", imageUrl);

    // Download the image
    const imageResponse = await fetch(imageUrl);
    if (!imageResponse.ok) {
      return new Response(
        JSON.stringify({ error: 'Failed to download generated image' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create a Blob from the response
    const imageBlob = await imageResponse.blob();
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `${assetType}_${timestamp}.png`;

    // Create storage bucket if it doesn't exist
    const { data: buckets } = await supabase.storage.listBuckets();
    if (!buckets?.find(bucket => bucket.name === 'game-assets')) {
      console.log("Creating game-assets bucket...");
      await supabase.storage.createBucket('game-assets', {
        public: true
      });
    }

    // Create folders if they don't exist
    try {
      const { data: folderExists } = await supabase.storage
        .from('game-assets')
        .list(assetType);
      
      if (!folderExists) {
        console.log(`Creating folder structure for ${assetType}...`);
        // Create an empty file to ensure folder exists
        await supabase.storage
          .from('game-assets')
          .upload(`${assetType}/.folder`, new Blob(['']));
      }
    } catch (error) {
      console.log(`Folder ${assetType} doesn't exist yet, will be created with upload.`);
    }

    // Upload to Supabase Storage
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
    console.error("Error in replicate-image-generator function:", error);
    return new Response(
      JSON.stringify({ error: error.message || 'An unknown error occurred' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
