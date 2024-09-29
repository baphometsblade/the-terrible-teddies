import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Home from './components/Home';
import Game from './components/Game';
import { SupabaseAuthUI } from './integrations/supabase/auth.jsx';
import { SupabaseProvider } from './utils/supabaseClient.jsx';

function App() {
  return (
    <SupabaseProvider>
      <Router>
        <div className="App">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/game" element={<Game />} />
            <Route path="/auth" element={<SupabaseAuthUI />} />
          </Routes>
        </div>
      </Router>
    </SupabaseProvider>
  );
}

export default App;