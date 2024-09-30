import React, { useState, useEffect } from 'react';
import TeddyCard from './TeddyCard';

const TeddyCollection = () => {
  const [teddies, setTeddies] = useState([]);

  useEffect(() => {
    // Simulating fetching teddies from an API or database
    setTeddies([
      { id: 1, name: "Whiskey Whiskers", attack: 7, defense: 5, specialMove: "On the Rocks" },
      { id: 2, name: "Madame Mistletoe", attack: 6, defense: 6, specialMove: "Sneak Kiss" },
      { id: 3, name: "Baron Von Blubber", attack: 8, defense: 4, specialMove: "Bubble Trouble" },
    ]);
  }, []);

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-6">My Teddy Collection</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {teddies.map(teddy => (
          <TeddyCard key={teddy.id} teddy={teddy} />
        ))}
      </div>
    </div>
  );
};

export default TeddyCollection;