import { createClient } from '@supabase/supabase-js';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseKey);

// ... (keep existing code)

export const useAddGeneratedImage = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (newImage) => {
      // Check if the 'energy_cost' column exists
      const { data: columns, error: columnError } = await supabase
        .from('generated_images')
        .select('*')
        .limit(1);

      if (columnError) throw columnError;

      const hasEnergyCost = columns.length > 0 && 'energy_cost' in columns[0];

      // If 'energy_cost' doesn't exist, remove it from the newImage object
      if (!hasEnergyCost) {
        delete newImage.energy_cost;
      }

      const { data, error } = await supabase
        .from('generated_images')
        .insert(newImage);
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['generatedImages']);
    },
  });
};

// ... (keep existing code)