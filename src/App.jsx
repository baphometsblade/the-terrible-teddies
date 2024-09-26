import React from 'react';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import Home from './components/Home';
import Game from './components/Game';
import { SupabaseProvider } from "./integrations/supabase";

function App() {
  return (
    <SupabaseProvider>
      <Router>
        <div className="App bg-gray-100 min-h-screen">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/play" element={<Game />} />
          </Routes>
        </div>
      </Router>
    </SupabaseProvider>
  );
}

export default App;