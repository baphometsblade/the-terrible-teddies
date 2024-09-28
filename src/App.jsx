import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Home from './components/Home';
import Game from './components/Game';
import Leaderboard from './components/Leaderboard';
import Shop from './components/Shop';
import PlayerProfile from './components/PlayerProfile';
import DailyChallenge from './components/DailyChallenge';
import TeddyCollection from './components/TeddyCollection';
import { SupabaseProvider } from './utils/supabaseClient.jsx';
import { webSocketManager } from './utils/websocket';

function App() {
  useEffect(() => {
    webSocketManager.connect();

    return () => {
      webSocketManager.disconnect();
    };
  }, []);

  return (
    <SupabaseProvider>
      <Router>
        <div className="App">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/play" element={<Game />} />
            <Route path="/leaderboard" element={<Leaderboard />} />
            <Route path="/shop" element={<Shop />} />
            <Route path="/profile" element={<PlayerProfile />} />
            <Route path="/daily-challenge" element={<DailyChallenge />} />
            <Route path="/collection" element={<TeddyCollection />} />
          </Routes>
        </div>
      </Router>
    </SupabaseProvider>
  );
}

export default App;