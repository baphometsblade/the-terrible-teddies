import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Home from './components/Home';
import Game from './components/Game';
import Leaderboard from './components/Leaderboard';
import Shop from './components/Shop';
import PlayerProfile from './components/PlayerProfile';
import DailyChallenge from './components/DailyChallenge';
import { setupDatabase } from './utils/setupDatabase';

function App() {
  React.useEffect(() => {
    setupDatabase();
  }, []);

  return (
    <Router>
      <div className="App">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/play" element={<Game />} />
          <Route path="/leaderboard" element={<Leaderboard />} />
          <Route path="/shop" element={<Shop />} />
          <Route path="/profile" element={<PlayerProfile />} />
          <Route path="/daily-challenge" element={<DailyChallenge />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;