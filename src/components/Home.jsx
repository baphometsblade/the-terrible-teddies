import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from "@/components/ui/button";

const Home = () => {
  return (
    <div className="container mx-auto px-4 py-8 text-center">
      <h1 className="text-4xl font-bold mb-4 text-purple-800">Welcome to Terrible Teddies</h1>
      <p className="mb-8 text-lg text-gray-700">Get ready for some cheeky teddy bear action!</p>
      <div className="space-y-4">
        <Link to="/play">
          <Button className="w-48 bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-4 rounded">
            Start Game
          </Button>
        </Link>
        <Link to="/rules">
          <Button className="w-48 bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded">
            Rules
          </Button>
        </Link>
        <Link to="/leaderboard">
          <Button className="w-48 bg-green-500 hover:bg-green-600 text-white font-bold py-2 px-4 rounded">
            Leaderboard
          </Button>
        </Link>
      </div>
    </div>
  );
};

export default Home;