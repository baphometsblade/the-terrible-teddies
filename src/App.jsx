import React from 'react';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SupabaseProvider } from './integrations/supabase/auth';
import Home from './components/Home';
import GameBoard from './components/GameBoard';
import DeckBuilder from './components/DeckBuilder';
import Header from './components/Header';
import { Toaster } from "@/components/ui/toaster";

const queryClient = new QueryClient();

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <SupabaseProvider>
        <Router>
          <div className="min-h-screen bg-gradient-to-b from-purple-100 to-pink-100">
            <Header />
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/game" element={<GameBoard />} />
              <Route path="/deck-builder" element={<DeckBuilder />} />
            </Routes>
            <Toaster />
          </div>
        </Router>
      </SupabaseProvider>
    </QueryClientProvider>
  );
}

export default App;