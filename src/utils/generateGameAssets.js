import { Configuration, OpenAIApi } from 'openai';
import { supabase } from '../integrations/supabase';

const configuration = new Configuration({
  apiKey: import.meta.env.VITE_OPENAI_API_KEY,
});
const openai = new OpenAIApi(configuration);

const CARD_TYPES = ['Action', 'Trap', 'Special', 'Defense', 'Boost'];
const TOTAL_CARDS = 40;

const generateCardName = (type) => {
  const adjectives = ['Mischievous', 'Cuddly', 'Sneaky', 'Fluffy', 'Grumpy', 'Playful', 'Sleepy', 'Bouncy', 'Silly', 'Fuzzy'];
  const nouns = ['Paw', 'Hug', 'Growl', 'Snuggle', 'Roar', 'Nap', 'Tickle', 'Giggle', 'Whisper', 'Tumble'];
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
  const basePrompt = `A cute cartoon teddy bear for a card game, representing a ${type.toLowerCase()} card named "${name}". The image should be colorful, child-friendly, and suitable for a card game called "Terrible Teddies".`;
  
  switch (type) {
    case 'Action':
      return `${basePrompt} The teddy bear should look active and ready to attack, maybe holding a pillow or a toy weapon.`;
    case 'Trap':
      return `${basePrompt} The teddy bear should look sneaky and mischievous, perhaps hiding behind something or setting up a prank.`;
    case 'Special':
      return `${basePrompt} The teddy bear should have a magical or unique appearance, possibly glowing or surrounded by sparkles.`;
    case 'Defense':
      return `${basePrompt} The teddy bear should look protective or have a shield, maybe hiding under a blanket fort.`;
    case 'Boost':
      return `${basePrompt} The teddy bear should look energized or powered-up, perhaps with a determined expression or flexing its stuffed muscles.`;
    default:
      return basePrompt;
  }
};

export async function generateGameAssets() {
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
        .upload(`${cardName.replace(/\s+/g, '-').toLowerCase()}.png`, await (await fetch(imageUrl)).blob());

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
      };

      generatedCards.push(cardData);
      generatedCount++;
      console.log(`Generated ${generatedCount}/${TOTAL_CARDS} cards`);
    } catch (error) {
      console.error('Error generating image:', error);
    }
  }

  // Insert all generated cards into the database
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
