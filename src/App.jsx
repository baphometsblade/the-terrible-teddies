import React from 'react';
import { Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SupabaseProvider } from './integrations/supabase/auth';
import Home from './components/Home';
import GameBoard from './components/GameBoard';
import { Button } from "@/components/ui/button";

const queryClient = new QueryClient();

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <SupabaseProvider>
        <div className="min-h-screen bg-gradient-to-b from-purple-100 to-pink-100">
          <nav className="bg-purple-600 p-4">
            <ul className="flex justify-center space-x-4">
              <li><Button variant="ghost" asChild><a href="/">Home</a></Button></li>
              <li><Button variant="ghost" asChild><a href="/game">Play</a></Button></li>
            </ul>
          </nav>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/game" element={<GameBoard />} />
          </Routes>
        </div>
      </SupabaseProvider>
    </QueryClientProvider>
  );
}

export default App;