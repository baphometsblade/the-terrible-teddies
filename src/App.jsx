import React from 'react';
import { Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SupabaseProvider } from './integrations/supabase/auth';
import Home from './components/Home';
import GameBoard from './components/GameBoard';
import DeckBuilder from './components/DeckBuilder';
import Shop from './components/Shop';
import Leaderboard from './components/Leaderboard';
import Profile from './components/Profile';
import Header from './components/Header';
import { Toaster } from "@/components/ui/toaster";

const queryClient = new QueryClient();

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <SupabaseProvider>
        <div className="min-h-screen bg-gradient-to-b from-purple-100 to-pink-100">
          <Header />
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/game" element={<GameBoard />} />
            <Route path="/deck-builder" element={<DeckBuilder />} />
            <Route path="/shop" element={<Shop />} />
            <Route path="/leaderboard" element={<Leaderboard />} />
            <Route path="/profile" element={<Profile />} />
          </Routes>
          <Toaster />
        </div>
      </SupabaseProvider>
    </QueryClientProvider>
  );
}

export default App;