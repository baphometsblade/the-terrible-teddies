import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from "@/components/ui/button";

const MainMenu = () => {
  return (
    <div className="flex flex-col items-center space-y-4">
      <Link to="/battle">
        <Button className="w-48">Battle Arena</Button>
      </Link>
      <Link to="/collection">
        <Button className="w-48">Teddy Collection</Button>
      </Link>
      <Link to="/evolution">
        <Button className="w-48">Evolve Teddy</Button>
      </Link>
      <Link to="/event">
        <Button className="w-48">Seasonal Event</Button>
      </Link>
      <Link to="/stats">
        <Button className="w-48">Battle Stats</Button>
      </Link>
      <Link to="/shop">
        <Button className="w-48">Shop</Button>
      </Link>
      <Link to="/profile">
        <Button className="w-48">Player Profile</Button>
      </Link>
      <Link to="/leaderboard">
        <Button className="w-48">Leaderboard</Button>
      </Link>
    </div>
  );
};

export default MainMenu;