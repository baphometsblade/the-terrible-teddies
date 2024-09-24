import { Configuration, OpenAIApi } from 'openai';
import { supabase } from '../lib/supabase';

const configuration = new Configuration({
  apiKey: import.meta.env.VITE_OPENAI_API_KEY,
});
const openai = new OpenAIApi(configuration);

const CARD_TYPES = ['Action', 'Trap', 'Special', 'Defense', 'Boost'];
const TOTAL_CARDS = 40;

const generateCardName = (type) => {
  const adjectives = ['Naughty', 'Cheeky', 'Saucy', 'Mischievous', 'Provocative', 'Flirty', 'Risqué', 'Daring', 'Sassy', 'Bold'];
  const nouns = ['Tease', 'Wink', 'Whisper', 'Touch', 'Caress', 'Embrace', 'Kiss', 'Flirt', 'Temptation', 'Seduction'];
  return `${adjectives[Math.floor(Math.random() * adjectives.length)]} ${nouns[Math.floor(Math.random() * nouns.length)]}`;
};

const generateCardEffect = (type) => {
  switch (type) {
    case 'Action':
      return `Deal ${Math.floor(Math.random() * 3) + 2} damage to the opponent.`;
    case 'Trap':
      return `When activated, negate the opponent's next action and deal ${Math.floor(Math.random() * 2) + 1} damage.`;
    case 'Special':
      return `Heal ${Math.floor(Math.random() * 3) + 1} HP and draw a card.`;
    case 'Defense':
      return `Reduce incoming damage by ${Math.floor(Math.random() * 2) + 1} for the next ${Math.floor(Math.random() * 2) + 1} turns.`;
    case 'Boost':
      return `Increase your Momentum Gauge by ${Math.floor(Math.random() * 2) + 1}.`;
    default:
      return 'No effect.';
  }
};

const generateCardPrompt = (type, name) => {
  return `A hyper-realistic, ultra-detailed teddy bear for the adult card game "Terrible Teddies". The teddy represents a ${type.toLowerCase()} card named "${name}". The image should be high resolution and showcase intricate details of the bear's fur, eyes, and any accessories or features that make it unique. The bear should have a mischievous and slightly menacing appearance, suitable for an adult-themed game.`;
};

export async function generateGameAssets(onProgress) {
  let generatedCount = 0;
  const generatedCards = [];

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
        .upload(`${cardName.replace(/\s+/g, '-').toLowerCase()}.png`, await (await fetch(imageUrl)).blob(), {
          cacheControl: '3600',
          upsert: false
        });

      if (error) throw error;

      const publicUrl = supabase.storage
        .from('card-images')
        .getPublicUrl(data.path).data.publicUrl;

      const cardData = {
        name: cardName,
        url: publicUrl,
        type: cardType,
        energy_cost: Math.floor(Math.random() * 3) + 1,
        effect: generateCardEffect(cardType),
        level: 1,
      };

      generatedCards.push(cardData);
      generatedCount++;
      if (onProgress) {
        onProgress((generatedCount / TOTAL_CARDS) * 100);
      }
      console.log(`Generated ${generatedCount}/${TOTAL_CARDS} cards`);
    } catch (error) {
      console.error('Error generating image:', error);
      throw error;
    }
  }

  const { data, error } = await supabase
    .from('generated_images')
    .insert(generatedCards);

  if (error) {
    console.error('Error inserting generated cards:', error);
    throw error;
  } else {
    console.log('All cards generated and inserted successfully');
  }

  return generatedCards;
}
