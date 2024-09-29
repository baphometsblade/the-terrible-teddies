import OpenAI from 'openai';
import { supabase } from '../lib/supabase';

const openai = new OpenAI({
  apiKey: import.meta.env.VITE_OPENAI_API_KEY,
});

export const generateBackgroundImage = async (description) => {
  try {
    const response = await openai.images.generate({
      model: "dall-e-3",
      prompt: `Create a hyper-realistic, detailed background image for an adult-themed card game called "Terrible Teddies". The scene should be ${description}. The style should be slightly provocative and humorous, suitable for an adult audience. Ensure the image is high resolution with intricate details that match the description.`,
      n: 1,
      size: "1024x1024",
    });

    const imageUrl = response.data[0].url;
    return imageUrl;
  } catch (error) {
    console.error('Error generating background image:', error);
    return null;
  }
};

export const saveBackgroundImage = async (description, imageUrl) => {
  try {
    const response = await fetch(imageUrl);
    const blob = await response.blob();
    const fileName = `background-${description.replace(/\s+/g, '-').toLowerCase()}.png`;

    const { data, error } = await supabase.storage
      .from('game-backgrounds')
      .upload(fileName, blob, {
        contentType: 'image/png',
        upsert: true
      });

    if (error) throw error;

    const { data: publicUrlData } = supabase.storage
      .from('game-backgrounds')
      .getPublicUrl(fileName);

    // Save background info to the database
    const { data: bgData, error: bgError } = await supabase
      .from('game_backgrounds')
      .insert({
        description: description,
        image_url: publicUrlData.publicUrl
      });

    if (bgError) throw bgError;

    return publicUrlData.publicUrl;
  } catch (error) {
    console.error('Error saving background image:', error);
    return null;
  }
};