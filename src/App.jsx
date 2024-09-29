import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Home from './components/Home';
import Game from './components/Game';
import Shop from './components/Shop';
import { SupabaseAuthUI } from './integrations/supabase/auth.jsx';
import { SupabaseProvider } from './utils/supabaseClient.jsx';
import { runMigrations } from './utils/dbMigrations';

function App() {
  useEffect(() => {
    runMigrations();
  }, []);

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