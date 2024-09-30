import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import TeddyCard from './TeddyCard';
import { Button } from "@/components/ui/button";
import { uploadTeddyImages } from '../utils/imageUpload';

const TeddyCollection = () => {
  const { data: teddies, isLoading, error } = useQuery({
    queryKey: ['teddies'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('terrible_teddies')
        .select('*');
      if (error) throw error;
      return data;
    },
  });

  const handleUploadImages = async () => {
    await uploadTeddyImages();
    // Refetch the teddies to update the UI with new image URLs
    await refetch();
  };

  if (isLoading) return <div>Loading teddies...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-4">Teddy Collection</h1>
      <Button onClick={handleUploadImages} className="mb-4">Upload Images to Storage</Button>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {teddies.map(teddy => (
          <TeddyCard key={teddy.id} teddy={teddy} />
        ))}
      </div>
    </div>
  );
};

export default TeddyCollection;