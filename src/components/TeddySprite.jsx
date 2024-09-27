import React from 'react';
import { supabase } from '../lib/supabase';

const TeddySprite = ({ teddy }) => {
  const [imageUrl, setImageUrl] = React.useState(null);

  React.useEffect(() => {
    const fetchImage = async () => {
      const { data, error } = supabase.storage
        .from('teddy-images')
        .getPublicUrl(`${teddy.name.replace(/\s+/g, '-').toLowerCase()}.png`);
      
      if (error) {
        console.error('Error fetching teddy image:', error);
      } else {
        setImageUrl(data.publicUrl);
      }
    };

    fetchImage();
  }, [teddy.name]);

  if (!imageUrl) {
    return <div className="w-32 h-32 bg-gray-300 animate-pulse rounded-lg"></div>;
  }

  return (
    <img 
      src={imageUrl} 
      alt={teddy.name} 
      className="w-32 h-32 object-cover rounded-lg shadow-lg"
    />
  );
};

export default TeddySprite;