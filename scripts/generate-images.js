import { createClient } from '@supabase/supabase-js';
import { Configuration, OpenAIApi } from 'openai';
import dotenv from 'dotenv';
import fetch from 'node-fetch';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY,
});
const openai = new OpenAIApi(configuration);

const CARD_TYPES = ['Action', 'Trap', 'Special', 'Defense', 'Boost'];

async function generateAndStoreImage(card) {
  try {
    console.log(`Generating image for ${card.name}`);
    const response = await openai.createImage({
      prompt: card.description,
      n: 1,
      size: '512x512',
    });

    const imageUrl = response.data.data[0].url;
    console.log('Image generated:', imageUrl);

    const imageName = `${Date.now()}-${card.name.replace(/\s+/g, '-')}.png`;
    const { data, error } = await supabase.storage
      .from('card-images')
      .upload(imageName, await fetch(imageUrl).then(r => r.buffer()), {
        contentType: 'image/png'
      });

    if (error) throw error;

    const { publicURL, error: urlError } = supabase.storage
      .from('card-images')
      .getPublicUrl(imageName);

    if (urlError) throw urlError;

    await supabase.from('generated_images').insert({
      name: card.name,
      url: publicURL,
      prompt: card.description,
      type: card.type,
      energy_cost: card.energyCost
    });

    console.log(`Image for ${card.name} generated and stored successfully`);
  } catch (error) {
    console.error(`Error generating/storing image for ${card.name}:`, error);
  }
}

async function generateAllImages() {
  const totalCards = 40;
  for (let i = 0; i < totalCards; i++) {
    const card = {
      name: `Card ${i + 1}`,
      description: `A cute teddy bear as a ${CARD_TYPES[i % CARD_TYPES.length]} card for a card game`,
      type: CARD_TYPES[i % CARD_TYPES.length],
      energyCost: Math.floor(Math.random() * 5) + 1
    };

    await generateAndStoreImage(card);
  }
}

generateAllImages().then(() => console.log('All images generated and stored'));