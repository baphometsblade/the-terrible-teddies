import React from 'react';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import Home from './components/Home';
import Game from './components/Game';
import { Leaderboard } from './components/Leaderboard';
import Shop from './components/Shop';
import { SupabaseProvider } from "./integrations/supabase";
import ErrorBoundary from './components/ErrorBoundary';

function App() {
  return (
    <ErrorBoundary>
      <SupabaseProvider>
        <Router>
          <div className="App bg-purple-100 min-h-screen">
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/play" element={<Game />} />
              <Route path="/leaderboard" element={<Leaderboard />} />
              <Route path="/shop" element={<Shop />} />
            </Routes>
          </div>
        </Router>
      </SupabaseProvider>
    </ErrorBoundary>
  );
}

export default App;
