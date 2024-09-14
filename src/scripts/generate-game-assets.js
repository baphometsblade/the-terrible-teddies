import { supabase } from '../integrations/supabase';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const CARD_TYPES = ['Action', 'Trap', 'Special', 'Defense', 'Boost'];
const TOTAL_CARDS = 40;

export async function generateGameAssets(progressCallback) {
  try {
    for (let i = 0; i < TOTAL_CARDS; i++) {
      const cardType = CARD_TYPES[i % CARD_TYPES.length];
      const cardName = `${cardType} Card ${Math.floor(i / 5) + 1}`;
      const prompt = `A cute teddy bear as a ${cardType.toLowerCase()} card for a card game called Terrible Teddies. The teddy should look mischievous and be doing an action related to its type. Cartoon style, vibrant colors, white background.`;

      const response = await openai.images.generate({
        prompt: prompt,
        n: 1,
        size: "512x512",
      });

      const imageUrl = response.data[0].url;

      const { data, error } = await supabase
        .from('generated_images')
        .insert({
          name: cardName,
          type: cardType,
          url: imageUrl,
          prompt: prompt,
        });

      if (error) throw error;

      progressCallback({
        progress: ((i + 1) / TOTAL_CARDS) * 100,
        currentImage: cardName,
        url: imageUrl,
      });
    }

    return { completed: true, total_generated: TOTAL_CARDS };
  } catch (error) {
    console.error('Error in asset generation process:', error);
    throw error;
  }
}
