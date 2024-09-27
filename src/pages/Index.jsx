import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import TeddyCard from '../components/TeddyCard';
import { supabase } from '../lib/supabase';

const Index = () => {
  const [backgroundImage, setBackgroundImage] = useState(null);
  const [teddies, setTeddies] = useState([]);

  useEffect(() => {
    fetchBackgroundImage();
    fetchTeddies();
  }, []);

  const fetchBackgroundImage = async () => {
    const { data, error } = await supabase.storage
      .from('background-images')
      .list();
    
    if (error) {
      console.error('Error fetching background images:', error);
    } else if (data && data.length > 0) {
      const randomBg = data[Math.floor(Math.random() * data.length)];
      const { publicURL, error: urlError } = supabase.storage
        .from('background-images')
        .getPublicUrl(randomBg.name);
      
      if (urlError) {
        console.error('Error getting public URL:', urlError);
      } else {
        setBackgroundImage(publicURL);
      }
    }
  };

  const fetchTeddies = async () => {
    const { data, error } = await supabase
      .from('terrible_teddies')
      .select('*')
      .limit(5);
    
    if (error) {
      console.error('Error fetching teddies:', error);
    } else {
      setTeddies(data);
    }
  };

  return (
    <div 
      className="container mx-auto px-4 py-8 min-h-screen"
      style={{
        backgroundImage: `url(${backgroundImage})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    >
      <h1 className="text-4xl font-bold mb-4 text-center text-white">Terrible Teddies</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
        {teddies.map(teddy => (
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