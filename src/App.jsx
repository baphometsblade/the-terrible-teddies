import React from 'react';
import { BrowserRouter as Router, Route, Routes, Link } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SupabaseProvider } from './integrations/supabase/auth';
import Home from './components/Home';
import GameBoard from './components/GameBoard';
import Shop from './components/Shop';
import Leaderboard from './components/Leaderboard';
import Profile from './components/Profile';
import { Button } from "@/components/ui/button";

const queryClient = new QueryClient();

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <SupabaseProvider>
        <Router>
          <div className="min-h-screen bg-gradient-to-b from-purple-100 to-pink-100">
            <nav className="bg-purple-600 p-4">
              <ul className="flex justify-center space-x-4">
                <li><Button variant="ghost" asChild><Link to="/">Home</Link></Button></li>
                <li><Button variant="ghost" asChild><Link to="/play">Play</Link></Button></li>
                <li><Button variant="ghost" asChild><Link to="/shop">Shop</Link></Button></li>
                <li><Button variant="ghost" asChild><Link to="/leaderboard">Leaderboard</Link></Button></li>
                <li><Button variant="ghost" asChild><Link to="/profile">Profile</Link></Button></li>
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
        </Router>
      </SupabaseProvider>
    </QueryClientProvider>
  );
}

export default App;