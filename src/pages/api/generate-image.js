import { Configuration, OpenAIApi } from 'openai';
import { supabase } from '../../integrations/supabase';

const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY,
});
const openai = new OpenAIApi(configuration);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { prompt, name, type, energy_cost } = req.body;

  try {
    console.log('Generating image with prompt:', prompt);
    const response = await openai.createImage({
      prompt,
      n: 1,
      size: '512x512',
    });

    const imageUrl = response.data.data[0].url;
    console.log('Image generated:', imageUrl);

    // Upload image to Supabase storage
    const { data, error } = await supabase.storage
      .from('card-images')
      .upload(`${Date.now()}-${name}.png`, await fetch(imageUrl).then(r => r.blob()), {
        contentType: 'image/png'
      });

    if (error) {
      console.error('Error uploading to Supabase:', error);
      throw error;
    }

    console.log('Image uploaded to Supabase:', data.path);

    // Get public URL of uploaded image
    const { publicURL, error: urlError } = supabase.storage
      .from('card-images')
      .getPublicUrl(data.path);

    if (urlError) {
      console.error('Error getting public URL:', urlError);
      throw urlError;
    }

    console.log('Public URL:', publicURL);

    // Save image data to Supabase database
    const { data: insertData, error: insertError } = await supabase
      .from('generated_images')
      .insert({
        name,
        url: publicURL,
        prompt,
        type,
        energy_cost
      });

    if (insertError) {
      console.error('Error inserting data into Supabase:', insertError);
      throw insertError;
    }

    console.log('Data inserted into Supabase:', insertData);

    res.status(200).json({ success: true, imageUrl: publicURL });
  } catch (error) {
    console.error('Error in image generation process:', error);
    res.status(500).json({ error: 'Failed to generate image', details: error.message });
  }
}