import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from "@/components/ui/button";
import { AssetGenerator } from './AssetGenerator';

const Home = () => {
  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-4xl font-bold mb-8">Welcome to Terrible Teddies</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div>
          <h2 className="text-2xl font-bold mb-4">Game Options</h2>
          <div className="space-y-4">
            <Link to="/play">
              <Button className="w-full">Play Game</Button>
            </Link>
            <Link to="/deck-builder">
              <Button className="w-full">Deck Builder</Button>
            </Link>
            <Link to="/shop">
              <Button className="w-full">Shop</Button>
            </Link>
            <Link to="/leaderboard">
              <Button className="w-full">Leaderboard</Button>
            </Link>
          </div>
        </div>
        <div>
          <AssetGenerator />
        </div>
      </div>
    </div>
  );
};

export default Home;