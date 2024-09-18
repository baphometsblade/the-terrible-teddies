import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import dotenv from 'dotenv';
import fetch from 'node-fetch';

dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

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
        size: "1024x1024",
      });

      const imageUrl = response.data[0].url;
      const imageName = `${Date.now()}-${cardName.replace(/\s+/g, '-')}.png`;

      const imageResponse = await fetch(imageUrl);
      const imageBuffer = await imageResponse.buffer();

      const { data, error } = await supabase.storage
        .from('card-images')
        .upload(imageName, imageBuffer, {
          contentType: 'image/png'
        });

      if (error) throw error;

      const { data: publicUrlData } = supabase.storage
        .from('card-images')
        .getPublicUrl(imageName);

      const publicUrl = publicUrlData.publicUrl;

      await supabase.from('generated_images').insert({
        name: cardName,
        type: cardType,
        url: publicUrl,
        prompt: prompt,
      });

      progressCallback({
        progress: ((i + 1) / TOTAL_CARDS) * 100,
        currentImage: cardName,
        url: publicUrl,
      });
    }

    return { completed: true, total_generated: TOTAL_CARDS };
  } catch (error) {
    console.error('Error in asset generation process:', error);
    throw error;
  }
}
