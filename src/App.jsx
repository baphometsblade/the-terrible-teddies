import React from 'react';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from "@/components/ui/toaster";
import { SupabaseProvider } from './integrations/supabase/auth';
import Home from './components/Home';
import Battle from './components/Battle';
import DeckBuilder from './components/DeckBuilder';
import Shop from './components/Shop';
import Profile from './components/Profile';
import Leaderboard from './components/Leaderboard';
import Auth from './components/Auth';
import Header from './components/Header';

const queryClient = new QueryClient();

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <SupabaseProvider>
        <Router>
          <div className="App bg-gray-100 min-h-screen">
            <Header />
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/battle" element={<Battle />} />
              <Route path="/deck-builder" element={<DeckBuilder />} />
              <Route path="/shop" element={<Shop />} />
              <Route path="/profile" element={<Profile />} />
              <Route path="/leaderboard" element={<Leaderboard />} />
              <Route path="/auth" element={<Auth />} />
            </Routes>
          </div>
        </Router>
        <Toaster />
      </SupabaseProvider>
    </QueryClientProvider>
  );
}

export default App;