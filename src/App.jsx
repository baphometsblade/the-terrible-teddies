import React, { useEffect } from 'react';
import { Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SupabaseProvider } from './integrations/supabase/auth';
import Home from './components/Home';
import GameBoard from './components/GameBoard';
import Shop from './components/Shop';
import Leaderboard from './components/Leaderboard';
import Profile from './components/Profile';
import { Button } from "@/components/ui/button";
import { setupDatabase } from './utils/setupDatabase';

const queryClient = new QueryClient();

function App() {
  useEffect(() => {
    setupDatabase();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <SupabaseProvider>
        <div className="min-h-screen bg-gradient-to-b from-purple-100 to-pink-100">
          <nav className="bg-purple-600 p-4">
            <ul className="flex justify-center space-x-4">
              <li><Button variant="ghost" asChild><a href="/">Home</a></Button></li>
              <li><Button variant="ghost" asChild><a href="/play">Play</a></Button></li>
              <li><Button variant="ghost" asChild><a href="/shop">Shop</a></Button></li>
              <li><Button variant="ghost" asChild><a href="/leaderboard">Leaderboard</a></Button></li>
              <li><Button variant="ghost" asChild><a href="/profile">Profile</a></Button></li>
            </ul>
          </nav>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/play" element={<GameBoard />} />
            <Route path="/shop" element={<Shop />} />
            <Route path="/leaderboard" element={<Leaderboard />} />
            <Route path="/profile" element={<Profile />} />
          </Routes>
        </div>
      </SupabaseProvider>
    </QueryClientProvider>
  );
}

export default App;