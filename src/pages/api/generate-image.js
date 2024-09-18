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
    const response = await openai.createImage({
      prompt,
      n: 1,
      size: '512x512',
    });

    const imageUrl = response.data.data[0].url;

    // Upload image to Supabase storage
    const { data, error } = await supabase.storage
      .from('card-images')
      .upload(`${Date.now()}-${name}.png`, await fetch(imageUrl).then(r => r.blob()), {
        contentType: 'image/png'
      });

    if (error) throw error;

    // Get public URL of uploaded image
    const { publicURL, error: urlError } = supabase.storage
      .from('card-images')
      .getPublicUrl(data.path);

    if (urlError) throw urlError;

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

    if (insertError) throw insertError;

    res.status(200).json({ success: true, imageUrl: publicURL });
  } catch (error) {
    console.error('Error generating image:', error);
    res.status(500).json({ error: 'Failed to generate image' });
  }
}