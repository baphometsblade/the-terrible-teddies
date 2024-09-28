import React from 'react';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SupabaseProvider } from './utils/supabaseClient.jsx';
import Header from './components/Header';
import Home from './components/Home';
import BattleArena from './components/BattleArena';
import Collection from './components/Collection';
import Shop from './components/Shop';
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
              <Route path="/battle" element={<BattleArena />} />
              <Route path="/collection" element={<Collection />} />
              <Route path="/shop" element={<Shop />} />
            </Routes>
            <Toaster />
          </div>
        </Router>
      </SupabaseProvider>
    </QueryClientProvider>
  );
}

export default App;