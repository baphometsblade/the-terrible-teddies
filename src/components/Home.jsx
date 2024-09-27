import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from "@/components/ui/button";
import { AssetGenerator } from './AssetGenerator';

const Home = () => {
  const handleAssetsGenerated = () => {
    console.log('Assets generated successfully');
    // You can add additional logic here if needed
  };

  return (
    <div className="container mx-auto px-4 py-8 text-center">
      <h1 className="text-4xl font-bold mb-4 text-purple-800">Welcome to Terrible Teddies</h1>
      <p className="mb-8 text-lg text-gray-700">Get ready for some cheeky teddy bear action!</p>
      <Link to="/play">
        <Button className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-4 rounded">
          Start Game
        </Button>
      </Link>
      <div className="mt-8">
        <AssetGenerator onComplete={handleAssetsGenerated} />
      </div>
    </div>
  );
};

export default Home;