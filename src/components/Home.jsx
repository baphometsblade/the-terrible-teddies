import React from 'react';
import { Link } from 'react-router-dom';

const Home = () => {
  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-4xl font-bold mb-4">Welcome to Cheeky Teddy Brawl</h1>
      <nav>
        <ul className="flex space-x-4">
          <li><Link to="/play" className="text-blue-500 hover:underline">Play Game</Link></li>
          <li><Link to="/leaderboard" className="text-blue-500 hover:underline">Leaderboard</Link></li>
          <li><Link to="/shop" className="text-blue-500 hover:underline">Shop</Link></li>
        </ul>
      </nav>
    </div>
  );
};

export default Home;