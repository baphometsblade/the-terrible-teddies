import { Configuration, OpenAIApi } from 'openai';
import { supabase } from '../lib/supabase';

const configuration = new Configuration({
  apiKey: import.meta.env.VITE_OPENAI_API_KEY,
});
const openai = new OpenAIApi(configuration);

export const generateTeddyImage = async (teddyName, teddyDescription) => {
  try {
    const response = await openai.createImage({
      prompt: `A hyper-realistic, ultra-detailed image of a cheeky, adult-themed teddy bear named ${teddyName}. ${teddyDescription}. The image should be visually striking and slightly provocative, perfect for an adult audience and suitable for a card game.`,
      n: 1,
      size: "512x512",
    });

    return response.data.data[0].url;
  } catch (error) {
    console.error('Error generating teddy image:', error);
    return null;
  }
};

export const generateBackgroundImage = async (theme) => {
  try {
    const response = await openai.createImage({
      prompt: `A detailed, high-quality background image for a card game with the theme: ${theme}. The image should be visually appealing and suitable for an adult audience.`,
      n: 1,
      size: "1024x1024",
    });

    return response.data.data[0].url;
  } catch (error) {
    console.error('Error generating background image:', error);
    return null;
  }
};