import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from "@/components/ui/button";
import { useSupabaseAuth } from '../utils/supabaseClient.jsx';

const Header = () => {
  const { session, logout } = useSupabaseAuth();

  return (
    <header className="bg-purple-800 p-4">
      <nav className="container mx-auto flex justify-between items-center">
        <Link to="/">
          <Button variant="ghost" className="text-white">Home</Button>
        </Link>
        <Link to="/battle">
          <Button variant="ghost" className="text-white">Battle</Button>
        </Link>
        <Link to="/collection">
          <Button variant="ghost" className="text-white">Collection</Button>
        </Link>
        <Link to="/shop">
          <Button variant="ghost" className="text-white">Shop</Button>
        </Link>
        {session ? (
          <Button variant="ghost" className="text-white" onClick={logout}>Logout</Button>
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