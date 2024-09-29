import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from "@/components/ui/button";

const Home = () => {
  return (
    <div className="container mx-auto px-4 py-8 text-center">
      <h1 className="text-4xl font-bold mb-4 text-purple-600">Welcome to Terrible Teddies</h1>
      <p className="mb-8 text-lg">Get ready for some cheeky teddy bear action! Collect naughty teddies, build your deck, and battle your way to the top in this irreverent card game.</p>
      <div className="space-y-4">
        <Link to="/battle">
          <Button className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded">
            Start Battle
          </Button>
        </Link>
        <Link to="/collection">
          <Button className="w-full bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded">
            View Collection
          </Button>
        </Link>
        <Link to="/shop">
          <Button className="w-full bg-green-500 hover:bg-green-600 text-white font-bold py-2 px-4 rounded">
            Visit Shop
          </Button>
        </Link>
        <Link to="/profile">
          <Button className="w-full bg-purple-500 hover:bg-purple-600 text-white font-bold py-2 px-4 rounded">
            My Profile
          </Button>
        </Link>
      </div>
    </div>
  );
};

export default Home;