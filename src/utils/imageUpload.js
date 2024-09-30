import { supabase } from '../lib/supabase';

export const uploadTeddyImages = async () => {
  try {
    // Fetch all teddy bears
    const { data: teddies, error } = await supabase
      .from('terrible_teddies')
      .select('*');

    if (error) throw error;

    for (const teddy of teddies) {
      if (teddy.image_url && !teddy.image_url.includes('supabase.co')) {
        // Download the image
        const response = await fetch(teddy.image_url);
        const blob = await response.blob();

        // Upload to Supabase Storage
        const fileName = `teddy_${teddy.id}.png`;
        const { data, error: uploadError } = await supabase.storage
          .from('teddy-images')
          .upload(fileName, blob, {
            contentType: 'image/png',
            upsert: true
          });

        if (uploadError) throw uploadError;

        // Get the public URL
        const { data: publicUrlData } = supabase.storage
          .from('teddy-images')
          .getPublicUrl(fileName);

        // Update the teddy record with the new URL
        const { error: updateError } = await supabase
          .from('terrible_teddies')
          .update({ image_url: publicUrlData.publicUrl })
          .eq('id', teddy.id);

        if (updateError) throw updateError;

        console.log(`Updated image for ${teddy.name}`);
      }
    }

    console.log('All images uploaded and records updated');
  } catch (error) {
    console.error('Error uploading images:', error);
  }
};