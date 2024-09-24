import { Configuration, OpenAIApi } from 'openai';
import { supabase } from '../integrations/supabase';

const configuration = new Configuration({
  apiKey: import.meta.env.VITE_OPENAI_API_KEY,
});
const openai = new OpenAIApi(configuration);

const CARD_TYPES = ['Action', 'Trap', 'Special', 'Defense', 'Boost'];
const TOTAL_CARDS = 40;

const generateCardName = (type) => {
  const adjectives = ['Mischievous', 'Cuddly', 'Sneaky', 'Fluffy', 'Grumpy', 'Playful'];
  const nouns = ['Paw', 'Hug', 'Growl', 'Snuggle', 'Roar', 'Nap'];
  return `${adjectives[Math.floor(Math.random() * adjectives.length)]} ${nouns[Math.floor(Math.random() * nouns.length)]}`;
};

const generateCardPrompt = (type, name) => {
  const basePrompt = `A cute cartoon teddy bear for a card game, representing a ${type.toLowerCase()} card named "${name}". The image should be colorful, child-friendly, and suitable for a card game called "Terrible Teddies".`;
  
  switch (type) {
    case 'Action':
      return `${basePrompt} The teddy bear should look active and ready to attack.`;
    case 'Trap':
      return `${basePrompt} The teddy bear should look sneaky and mischievous.`;
    case 'Special':
      return `${basePrompt} The teddy bear should have a magical or unique appearance.`;
    case 'Defense':
      return `${basePrompt} The teddy bear should look protective or have a shield.`;
    case 'Boost':
      return `${basePrompt} The teddy bear should look energized or powered-up.`;
    default:
      return basePrompt;
  }
};

export async function generateGameAssets(onProgress) {
  let generatedCount = 0;

  for (let i = 0; i < TOTAL_CARDS; i++) {
    const cardType = CARD_TYPES[Math.floor(Math.random() * CARD_TYPES.length)];
    const cardName = generateCardName(cardType);
    const prompt = generateCardPrompt(cardType, cardName);

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
          effect: `Effect description for ${cardName}`,
        });

      if (cardError) throw cardError;

      generatedCount++;
      onProgress((generatedCount / TOTAL_CARDS) * 100);
    } catch (error) {
      console.error('Error generating image:', error);
    }
  }
}
