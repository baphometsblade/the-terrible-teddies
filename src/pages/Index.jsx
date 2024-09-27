import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import TeddyCard from '../components/TeddyCard';
import { Button } from "@/components/ui/button";

const fetchTeddies = async () => {
  const { data, error } = await supabase
    .from('terrible_teddies')
    .select('*')
    .limit(5);
  if (error) throw error;
  return data;
};

const fetchBackgroundImage = async () => {
  const { data, error } = await supabase.storage
    .from('background-images')
    .list();
  if (error) throw error;
  if (data && data.length > 0) {
    const randomBg = data[Math.floor(Math.random() * data.length)];
    const { publicURL, error: urlError } = supabase.storage
      .from('background-images')
      .getPublicUrl(randomBg.name);
    if (urlError) throw urlError;
    return publicURL;
  }
  return null;
};

const Index = () => {
  const { data: teddies, isLoading: teddiesLoading, error: teddiesError } = useQuery({
    queryKey: ['teddies'],
    queryFn: fetchTeddies,
  });

  const { data: backgroundImage, isLoading: bgLoading, error: bgError } = useQuery({
    queryKey: ['backgroundImage'],
    queryFn: fetchBackgroundImage,
  });

  if (teddiesLoading || bgLoading) return <div className="text-center mt-8">Loading...</div>;
  if (teddiesError || bgError) return <div className="text-center mt-8">Error loading data</div>;

  return (
    <div 
      className="container mx-auto px-4 py-8 min-h-screen"
      style={{
        backgroundImage: backgroundImage ? `url(${backgroundImage})` : 'none',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    >
      <h1 className="text-4xl font-bold mb-4 text-center text-white">Terrible Teddies</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
        {teddies && teddies.map(teddy => (
          <TeddyCard key={teddy.id} teddy={teddy} />
        ))}
      </div>
      <div className="text-center">
        <Button className="mt-4 bg-purple-500 hover:bg-purple-600 text-white">
          Start Game
        </Button>
      </div>
    </div>
  );
};

export default Index;