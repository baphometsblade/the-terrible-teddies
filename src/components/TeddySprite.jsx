import React, { useState, useEffect } from 'react';
import { generateTeddyImage } from '../utils/imageGenerator';

const TeddySprite = ({ teddy }) => {
  const [imageUrl, setImageUrl] = useState(null);

  useEffect(() => {
    const fetchImage = async () => {
      const url = await generateTeddyImage(teddy.name, teddy.description);
      setImageUrl(url);
    };

    fetchImage();
  }, [teddy]);

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