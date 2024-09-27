import React from 'react';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import Home from './components/Home';
import GameBoard from './components/GameBoard';

function App() {
  return (
    <Router>
      <div className="App">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/play" element={<GameBoard />} />
          {/* Add more routes here for Rules and Leaderboard */}
        </Routes>
      </div>
    </Router>
  );
}

export default App;