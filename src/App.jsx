import React, { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { runMigrations } from './utils/dbMigrations';
import Home from './components/Home';
import Game from './components/Game';
import Shop from './components/Shop';
import { SupabaseAuthUI } from './integrations/supabase/auth.jsx';
import { SupabaseProvider } from './utils/supabaseClient.jsx';

function App() {
  const [isDbReady, setIsDbReady] = useState(false);

  useEffect(() => {
    const initializeDb = async () => {
      try {
        await runMigrations();
        setIsDbReady(true);
      } catch (error) {
        console.error('Failed to initialize database:', error);
        // Handle the error appropriately, e.g., show an error message to the user
      }
    };
    initializeDb();
  }, []);

  if (!isDbReady) {
    return <div>Initializing database...</div>;
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