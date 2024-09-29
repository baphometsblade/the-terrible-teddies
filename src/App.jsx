import React from 'react';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import Home from './components/Home';
import Game from './components/Game';
import TeddyCollection from './components/TeddyCollection';
import Shop from './components/Shop';
import Leaderboard from './components/Leaderboard';
import Profile from './components/Profile';
import Auth from './components/Auth';
import DailyChallenge from './components/DailyChallenge';

function App() {
  return (
    <Router>
      <div className="App">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/game" element={<Game />} />
          <Route path="/collection" element={<TeddyCollection />} />
          <Route path="/shop" element={<Shop />} />
          <Route path="/leaderboard" element={<Leaderboard />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/daily-challenge" element={<DailyChallenge />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;