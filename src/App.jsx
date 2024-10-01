import React, { useEffect, useState } from 'react';
import { Routes, Route } from 'react-router-dom';
import { initSupabase } from './lib/supabase';
import { useToast } from "@/components/ui/use-toast";
import Header from './components/Header';
import Auth from './components/Auth';
import Game from './components/Game';
import PlayerProfile from './components/PlayerProfile';
import Shop from './components/Shop';
import Leaderboard from './components/Leaderboard';
import DailyChallenge from './components/DailyChallenge';

function App() {
  const [isSupabaseInitialized, setIsSupabaseInitialized] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    const init = async () => {
      try {
        const initialized = await initSupabase();
        setIsSupabaseInitialized(initialized);
        if (!initialized) {
          toast({
            title: "Initialization Error",
            description: "Failed to connect to the database. Please try again later.",
            variant: "destructive",
          });
        }
      } catch (error) {
        console.error('Initialization error:', error);
        toast({
          title: "Initialization Error",
          description: error.message,
          variant: "destructive",
        });
      }
    };
    init();
  }, [toast]);

  if (!isSupabaseInitialized) {
    return <div>Initializing application...</div>;
  }

  return (
    <div className="App">
      <Header />
      <Routes>
        <Route path="/" element={<Game />} />
        <Route path="/auth" element={<Auth />} />
        <Route path="/profile" element={<PlayerProfile />} />
        <Route path="/shop" element={<Shop />} />
        <Route path="/leaderboard" element={<Leaderboard />} />
        <Route path="/daily-challenge" element={<DailyChallenge />} />
      </Routes>
    </div>
  );
}

export default App;