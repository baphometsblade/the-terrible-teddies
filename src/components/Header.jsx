import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from "@/components/ui/button";

const Header = () => {
  return (
    <header className="bg-purple-800 p-4">
      <nav className="container mx-auto flex justify-between items-center">
        <Link to="/">
          <Button variant="ghost">Game</Button>
        </Link>
        <Link to="/shop">
          <Button variant="ghost">Shop</Button>
        </Link>
        <Link to="/profile">
          <Button variant="ghost">Profile</Button>
        </Link>
        <Link to="/leaderboard">
          <Button variant="ghost">Leaderboard</Button>
        </Link>
      </nav>
    </header>
  );
};

export default Header;