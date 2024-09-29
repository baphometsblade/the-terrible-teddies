import { supabase } from '../lib/supabase';

export const generateBackgroundImage = async (description) => {
  // This is a placeholder function. In a real implementation, you would use an AI image generation service.
  console.log(`Generating background image for: ${description}`);
  return `https://placekitten.com/800/600?text=${encodeURIComponent(description)}`;
};

export const saveBackgroundImage = async (description, imageUrl) => {
  try {
    const { data, error } = await supabase.storage
      .from('backgrounds')
      .upload(`${Date.now()}-${description}.jpg`, await (await fetch(imageUrl)).blob(), {
        contentType: 'image/jpeg'
      });

    if (error) throw error;

    const { data: { publicUrl } } = supabase.storage
      .from('backgrounds')
      .getPublicUrl(data.path);

    return publicUrl;
  } catch (error) {
    console.error('Error saving background image:', error);
    return null;
  }
};