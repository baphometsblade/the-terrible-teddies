import React from 'react';
import { Link } from 'react-router-dom';
import { useSupabaseAuth } from '../hooks/useSupabaseAuth';
import { Button } from "@/components/ui/button";

const Header = () => {
  const { session, signOut } = useSupabaseAuth();

  return (
    <header className="bg-purple-600 text-white p-4">
      <div className="container mx-auto flex justify-between items-center">
        <Link to="/" className="text-2xl font-bold">Terrible Teddies</Link>
        <nav>
          <ul className="flex space-x-4">
            <li><Link to="/battle">Battle Arena</Link></li>
            <li><Link to="/collection">Collection</Link></li>
            <li><Link to="/shop">Shop</Link></li>
            {session ? (
              <li>
                <Button onClick={signOut} variant="outline">Sign Out</Button>
              </li>
            ) : (
              <li><Link to="/auth">Sign In</Link></li>
            )}
          </ul>
        </nav>
      </div>
    </header>
  );
};

export default Header;