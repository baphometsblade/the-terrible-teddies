import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import TeddyCard from './TeddyCard';
import { Button } from "@/components/ui/button";
import { uploadTeddyImages } from '../utils/imageUpload';
import { useToast } from "@/components/ui/use-toast";

const TeddyCollection = ({ onSelectTeddy }) => {
  const [selectedTeddy, setSelectedTeddy] = useState(null);
  const { toast } = useToast();

  const { data: teddies, isLoading, error, refetch } = useQuery({
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
    toast({
      title: "Images Uploaded",
      description: "Teddy images have been uploaded to storage.",
    });
    refetch();
  };

  const handleSelectTeddy = (teddy) => {
    setSelectedTeddy(teddy);
    if (onSelectTeddy) {
      onSelectTeddy(teddy);
    }
  };

  if (isLoading) return <div>Loading teddies...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-4">Teddy Collection</h1>
      <Button onClick={handleUploadImages} className="mb-4">Upload Images to Storage</Button>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {teddies.map(teddy => (
          <div 
            key={teddy.id} 
            className={`cursor-pointer ${selectedTeddy?.id === teddy.id ? 'border-2 border-blue-500' : ''}`}
            onClick={() => handleSelectTeddy(teddy)}
          >
            <TeddyCard teddy={teddy} />
          </div>
        ))}
      </div>
      {selectedTeddy && (
        <div className="mt-4">
          <h2 className="text-2xl font-bold">Selected Teddy</h2>
          <TeddyCard teddy={selectedTeddy} />
        </div>
      )}
    </div>
  );
};

export default TeddyCollection;