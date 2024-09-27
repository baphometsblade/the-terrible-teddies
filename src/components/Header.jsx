import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from "@/components/ui/button";
import { useSupabaseAuth } from '../integrations/supabase/auth';

const Header = () => {
  const { session, logout } = useSupabaseAuth();

  return (
    <header className="bg-purple-800 p-4">
      <nav className="container mx-auto flex justify-between items-center">
        <Link to="/">
          <Button variant="ghost" className="text-white">Home</Button>
        </Link>
        <Link to="/game">
          <Button variant="ghost" className="text-white">Play</Button>
        </Link>
        <Link to="/deck-builder">
          <Button variant="ghost" className="text-white">Deck Builder</Button>
        </Link>
        <Link to="/shop">
          <Button variant="ghost" className="text-white">Shop</Button>
        </Link>
        <Link to="/leaderboard">
          <Button variant="ghost" className="text-white">Leaderboard</Button>
        </Link>
        {session ? (
          <>
            <Link to="/profile">
              <Button variant="ghost" className="text-white">Profile</Button>
            </Link>
            <Button variant="ghost" className="text-white" onClick={logout}>Logout</Button>
          </>
        ) : (
          <Link to="/auth">
            <Button variant="ghost" className="text-white">Login</Button>
          </Link>
        )}
      </nav>
    </header>
  );
};

export default Header;