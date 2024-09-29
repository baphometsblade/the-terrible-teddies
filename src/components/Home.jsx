import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from "@/components/ui/button";

const Home = () => {
  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-4xl font-bold mb-8 text-center">Welcome to Terrible Teddies</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Link to="/game">
          <Button className="w-full">Battle Arena</Button>
        </Link>
        <Link to="/collection">
          <Button className="w-full">My Teddy Collection</Button>
        </Link>
        <Link to="/shop">
          <Button className="w-full">Teddy Shop</Button>
        </Link>
        <Link to="/leaderboard">
          <Button className="w-full">Leaderboard</Button>
        </Link>
      </div>
    </div>
  );
};

export default Home;