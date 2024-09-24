import { Configuration, OpenAIApi } from 'openai';
import { supabase } from '../integrations/supabase';

const configuration = new Configuration({
  apiKey: import.meta.env.VITE_OPENAI_API_KEY,
});
const openai = new OpenAIApi(configuration);

const generatePrompt = (teddyName, teddyType) => {
  return `A hyper-realistic, ultra-detailed teddy bear named ${teddyName} for the game Terrible Teddies. The teddy is a ${teddyType} type character with a mischievous and slightly menacing appearance. The image should be high resolution and showcase intricate details of the bear's fur, eyes, and any accessories or features that make it unique.`;
};

export const generateAndSaveAsset = async (teddyName, teddyType) => {
  try {
    const response = await openai.createImage({
      prompt: generatePrompt(teddyName, teddyType),
      n: 1,
      size: "1024x1024",
    });

    const imageUrl = response.data.data[0].url;
    const imageName = `${teddyName.replace(/\s+/g, '_').toLowerCase()}.png`;

    // Download the image
    const imageResponse = await fetch(imageUrl);
    const imageBlob = await imageResponse.blob();

    // Upload to Supabase Storage
    const { data, error } = await supabase.storage
      .from('teddy-images')
      .upload(imageName, imageBlob, {
        contentType: 'image/png',
        upsert: true
      });

    if (error) throw error;

    // Get public URL
    const { data: publicUrlData } = supabase.storage
      .from('teddy-images')
      .getPublicUrl(imageName);

    return publicUrlData.publicUrl;
  } catch (error) {
    console.error('Error generating or saving asset:', error);
    throw error;
  }
};

export const generateAllAssets = async (teddyList) => {
  const generatedAssets = [];
  for (const teddy of teddyList) {
    const assetUrl = await generateAndSaveAsset(teddy.name, teddy.type);
    generatedAssets.push({ ...teddy, imageUrl: assetUrl });
  }
  return generatedAssets;
};
