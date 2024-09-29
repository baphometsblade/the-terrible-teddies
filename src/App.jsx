import React, { useEffect } from 'react';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from "@/components/ui/toaster";
import { SupabaseProvider } from './integrations/supabase/auth';
import Home from './components/Home';
import GameBoard from './components/GameBoard';
import TeddyCollection from './components/TeddyCollection';
import Shop from './components/Shop';
import Leaderboard from './components/Leaderboard';
import Profile from './components/Profile';
import Auth from './components/Auth';
import DailyChallenge from './components/DailyChallenge';
import Header from './components/Header';
import { initializeDatabase } from './utils/setupDatabase';

const queryClient = new QueryClient();

function App() {
  useEffect(() => {
    initializeDatabase();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <SupabaseProvider>
        <Router>
          <div className="App bg-gray-100 min-h-screen">
            <Header />
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/game" element={<GameBoard />} />
              <Route path="/collection" element={<TeddyCollection />} />
              <Route path="/shop" element={<Shop />} />
              <Route path="/leaderboard" element={<Leaderboard />} />
              <Route path="/profile" element={<Profile />} />
              <Route path="/auth" element={<Auth />} />
              <Route path="/daily-challenge" element={<DailyChallenge />} />
            </Routes>
          </div>
        </Router>
        <Toaster />
      </SupabaseProvider>
    </QueryClientProvider>
  );
}

export default App;