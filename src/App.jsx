import React, { useEffect } from 'react';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SupabaseProvider } from './utils/supabaseClient';
import Home from './components/Home';
import Game from './components/Game';
import Shop from './components/Shop';
import { Toaster } from "@/components/ui/toaster";
import { setupDatabase } from './utils/setupDatabase';

const queryClient = new QueryClient();

function App() {
  useEffect(() => {
    setupDatabase();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <SupabaseProvider>
        <Router>
          <div className="App">
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/game" element={<Game />} />
              <Route path="/shop" element={<Shop />} />
            </Routes>
          </div>
        </Router>
        <Toaster />
      </SupabaseProvider>
    </QueryClientProvider>
  );
}

export default App;