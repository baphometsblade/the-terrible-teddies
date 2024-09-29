import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from "@/components/ui/button";
import { useSupabaseAuth } from '../utils/supabaseClient.jsx';

const Home = () => {
  const { session } = useSupabaseAuth();
  const navigate = useNavigate();

  const handleStartGame = () => {
    if (session) {
      navigate('/game');
    } else {
      navigate('/auth');
    }
  };

  return (
    <div className="container mx-auto px-4 py-8 text-center">
      <h1 className="text-4xl font-bold mb-4 text-purple-600">Welcome to Terrible Teddies</h1>
      <p className="mb-8 text-lg">Get ready for some cheeky teddy bear action! Collect naughty teddies, build your deck, and battle your way to the top in this irreverent card game.</p>
      <Button 
        onClick={handleStartGame} 
        className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-4 rounded"
      >
        {session ? 'Start Battle' : 'Login to Play'}
      </Button>
    </div>
  );
};

export default Home;