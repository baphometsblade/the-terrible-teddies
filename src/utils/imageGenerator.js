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

export const saveTeddyImage = async (teddyName, imageUrl) => {
  try {
    const response = await fetch(imageUrl);
    const blob = await response.blob();
    const fileName = `${teddyName.replace(/\s+/g, '-').toLowerCase()}.png`;

    const { data, error } = await supabase.storage
      .from('teddy-images')
      .upload(fileName, blob, {
        contentType: 'image/png',
        upsert: true
      });

    if (error) throw error;

    const { data: publicUrlData } = supabase.storage
      .from('teddy-images')
      .getPublicUrl(fileName);

    return publicUrlData.publicUrl;
  } catch (error) {
    console.error('Error saving teddy image:', error);
    return null;
  }
};