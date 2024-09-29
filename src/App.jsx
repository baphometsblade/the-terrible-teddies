import React, { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { runMigrations } from './utils/dbMigrations';
import { initializeSupabase } from './lib/supabase';
import Home from './components/Home';
import Game from './components/Game';
import Shop from './components/Shop';
import { SupabaseAuthUI } from './integrations/supabase/auth.jsx';
import { SupabaseProvider } from './utils/supabaseClient.jsx';

function App() {
  const [isDbReady, setIsDbReady] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const initializeDb = async () => {
      try {
        await initializeSupabase();
        await runMigrations();
        setIsDbReady(true);
      } catch (error) {
        console.error('Failed to initialize database:', error);
        setError(`Failed to initialize database: ${error.message}. Please try refreshing the page or contact support if the issue persists.`);
      }
    };
    initializeDb();
  }, []);

  if (error) {
    return <div className="text-center mt-8 text-red-600">{error}</div>;
  }

  if (!isDbReady) {
    return <div className="text-center mt-8">Initializing database... This may take a few moments.</div>;
  }

  return (
    <SupabaseProvider>
      <Router>
        <div className="App">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/game" element={<Game />} />
            <Route path="/shop" element={<Shop />} />
            <Route path="/auth" element={<SupabaseAuthUI />} />
          </Routes>
        </div>
      </Router>
    </SupabaseProvider>
  );
}

export default App;