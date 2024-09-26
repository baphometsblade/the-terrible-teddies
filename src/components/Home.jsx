import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from "@/components/ui/button";

const Home = () => {
  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-4xl font-bold mb-4">Welcome to Terrible Teddies</h1>
      <p className="mb-4">Get ready for some cheeky teddy bear action!</p>
      <Link to="/play">
        <Button>Start Game</Button>
      </Link>
    </div>
  );
};

export default Home;