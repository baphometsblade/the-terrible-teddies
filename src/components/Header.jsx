import React from 'react';
import { Button } from "@/components/ui/button";

const Header = ({ setCurrentView }) => {
  return (
    <header className="bg-purple-800 p-4">
      <nav className="container mx-auto flex justify-between items-center">
        <Button variant="ghost" onClick={() => setCurrentView('game')}>
          Game
        </Button>
        <Button variant="ghost" onClick={() => setCurrentView('shop')}>
          Shop
        </Button>
        <Button variant="ghost" onClick={() => setCurrentView('profile')}>
          Profile
        </Button>
        <Button variant="ghost" onClick={() => setCurrentView('leaderboard')}>
          Leaderboard
        </Button>
      </nav>
    </header>
  );
};

export default Header;