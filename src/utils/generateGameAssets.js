import { Configuration, OpenAIApi } from 'openai';
import { supabase } from '../integrations/supabase';

const configuration = new Configuration({
  apiKey: import.meta.env.VITE_OPENAI_API_KEY,
});
const openai = new OpenAIApi(configuration);

const CARD_TYPES = ['Action', 'Trap', 'Special', 'Defense', 'Boost'];
const TOTAL_CARDS = 40;

export async function generateGameAssets(onProgress) {
  let generatedCount = 0;

  for (let i = 0; i < TOTAL_CARDS; i++) {
    const cardType = CARD_TYPES[Math.floor(Math.random() * CARD_TYPES.length)];
    const cardName = `${cardType} Card ${i + 1}`;
    const prompt = `A cute cartoon teddy bear for a card game, representing a ${cardType.toLowerCase()} card named "${cardName}". The image should be colorful, child-friendly, and suitable for a card game called "Terrible Teddies".`;

    try {
      const response = await openai.createImage({
        prompt: prompt,
        n: 1,
        size: "512x512",
      });

      const imageUrl = response.data.data[0].url;
      const { data, error } = await supabase.storage
        .from('card-images')
        .upload(`${cardName.replace(/\s+/g, '-').toLowerCase()}.png`, await (await fetch(imageUrl)).blob());

      if (error) throw error;

      const { data: cardData, error: cardError } = await supabase
        .from('generated_images')
        .insert({
          name: cardName,
          url: `${import.meta.env.VITE_SUPABASE_PROJECT_URL}/storage/v1/object/public/card-images/${data.path}`,
          type: cardType,
          energy_cost: Math.floor(Math.random() * 5) + 1,
        });

      if (cardError) throw cardError;

      generatedCount++;
      onProgress((generatedCount / TOTAL_CARDS) * 100);
    } catch (error) {
      console.error('Error generating image:', error);
    }
  }
}
