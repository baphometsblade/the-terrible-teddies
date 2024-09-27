import React from 'react';
import { Routes, Route, Link } from 'react-router-dom';
import { useSupabaseAuth } from './integrations/supabase/auth';
import { Button } from "@/components/ui/button";
import Index from './pages/Index';
import GameBoard from './components/GameBoard';
import Shop from './components/Shop';
import Profile from './components/Profile';
import { Auth } from './components/Auth';

function App() {
  const { session } = useSupabaseAuth();

  return (
    <div className="App min-h-screen bg-gradient-to-b from-purple-100 to-pink-100">
      <nav className="bg-purple-600 p-4">
        <ul className="flex justify-center space-x-4">
          <li><Button variant="ghost" asChild><Link to="/">Home</Link></Button></li>
          <li><Button variant="ghost" asChild><Link to="/game">Play</Link></Button></li>
          <li><Button variant="ghost" asChild><Link to="/shop">Shop</Link></Button></li>
          <li><Button variant="ghost" asChild><Link to="/profile">Profile</Link></Button></li>
          {!session && <li><Button variant="ghost" asChild><Link to="/auth">Login</Link></Button></li>}
        </ul>
      </nav>
      <Routes>
        <Route path="/" element={<Index />} />
        <Route path="/game" element={session ? <GameBoard /> : <Auth />} />
        <Route path="/shop" element={session ? <Shop /> : <Auth />} />
        <Route path="/profile" element={session ? <Profile /> : <Auth />} />
        <Route path="/auth" element={<Auth />} />
      </Routes>
    </div>
  );
}

export default App;