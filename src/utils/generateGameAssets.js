import { Configuration, OpenAIApi } from 'openai';
import { supabase } from '../integrations/supabase';

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
      return `Tease the opponent, dealing ${Math.floor(Math.random() * 3) + 2} damage.`;
    case 'Trap':
      return `When activated, distract the opponent, negating their next action and dealing ${Math.floor(Math.random() * 2) + 1} damage.`;
    case 'Special':
      return `Charm your way to healing ${Math.floor(Math.random() * 3) + 1} HP and draw a card.`;
    case 'Defense':
      return `Use your allure to reduce incoming damage by ${Math.floor(Math.random() * 2) + 1} for the next ${Math.floor(Math.random() * 2) + 1} turns.`;
    case 'Boost':
      return `Flirt to increase your Momentum Gauge by ${Math.floor(Math.random() * 2) + 1}.`;
    default:
      return 'No effect.';
  }
};

const generateCardPrompt = (type, name) => {
  const basePrompt = `A cheeky, adult-themed teddy bear for a card game, representing a ${type.toLowerCase()} card named "${name}". The image should be suggestive and humorous, suitable for an adult card game called "Terrible Teddies".`;
  
  switch (type) {
    case 'Action':
      return `${basePrompt} The teddy bear should look flirtatious and ready to tease, maybe with a saucy wink or blowing a kiss.`;
    case 'Trap':
      return `${basePrompt} The teddy bear should look mischievous and seductive, perhaps in a playful pose or setting up a cheeky prank.`;
    case 'Special':
      return `${basePrompt} The teddy bear should have a magical or unique appearance, possibly surrounded by hearts or with a charming, irresistible aura.`;
    case 'Defense':
      return `${basePrompt} The teddy bear should look coy or protective, maybe hiding behind lingerie or a feather boa.`;
    case 'Boost':
      return `${basePrompt} The teddy bear should look confident and alluring, perhaps with a determined expression or in a provocative pose.`;
    default:
      return basePrompt;
  }
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
