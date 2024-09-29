import { supabase } from '../lib/supabase';

export const uploadImage = async (file, path) => {
  const { data, error } = await supabase.storage
    .from('teddy-images')
    .upload(path, file);

  if (error) {
    console.error('Error uploading image:', error);
    return null;
  }

  const { data: publicUrl } = supabase.storage
    .from('teddy-images')
    .getPublicUrl(data.path);

  return publicUrl.publicUrl;
};