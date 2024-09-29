import { supabase } from '../lib/supabase';

export const uploadBearImage = async (bearName, imageUrl) => {
  try {
    const response = await fetch(imageUrl);
    const blob = await response.blob();
    const fileName = `${bearName.replace(/\s+/g, '-').toLowerCase()}.png`;
    const filePath = `bears/${fileName}`;

    const { data, error } = await supabase.storage
      .from('teddy-images')
      .upload(filePath, blob, {
        contentType: 'image/png',
        upsert: true
      });

    if (error) throw error;

    const { data: publicUrlData } = supabase.storage
      .from('teddy-images')
      .getPublicUrl(filePath);

    return publicUrlData.publicUrl;
  } catch (error) {
    console.error('Error uploading bear image:', error);
    return null;
  }
};