import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from "@/components/ui/button";
import { useSupabaseAuth } from '../integrations/supabase/auth';

const Home = () => {
  const { session } = useSupabaseAuth();

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-4xl font-bold mb-8 text-center text-purple-600">Welcome to Terrible Teddies</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Link to="/battle">
          <Button className="w-full h-16 text-xl">Battle</Button>
        </Link>
        <Link to="/collection">
          <Button className="w-full h-16 text-xl">Collection</Button>
        </Link>
        <Link to="/shop">
          <Button className="w-full h-16 text-xl">Shop</Button>
        </Link>
        {session ? (
          <Link to="/profile">
            <Button className="w-full h-16 text-xl">Profile</Button>
          </Link>
        ) : (
          <Link to="/auth">
            <Button className="w-full h-16 text-xl">Login/Register</Button>
          </Link>
        )}
        <Link to="/leaderboard">
          <Button className="w-full h-16 text-xl">Leaderboard</Button>
        </Link>
        <Link to="/daily-challenge">
          <Button className="w-full h-16 text-xl">Daily Challenge</Button>
        </Link>
      </div>
    </div>
  );
};

export default Home;