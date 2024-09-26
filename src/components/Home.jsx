import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from "@/components/ui/button";

const Home = () => {
  return (
    <div className="container mx-auto px-4 py-8 text-center">
      <h1 className="text-4xl font-bold mb-6 text-purple-800">Welcome to Cheeky Teddy Brawl</h1>
      <nav className="space-y-4">
        <Button asChild className="w-full max-w-xs">
          <Link to="/play">Play Game</Link>
        </Button>
        <Button asChild className="w-full max-w-xs">
          <Link to="/leaderboard">Leaderboard</Link>
        </Button>
        <Button asChild className="w-full max-w-xs">
          <Link to="/shop">Shop</Link>
        </Button>
      </nav>
    </div>
  );
};

export default Home;
