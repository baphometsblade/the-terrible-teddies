import React, { useEffect } from 'react';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import Home from './components/Home';
import Game from './components/Game';

function App() {
  useEffect(() => {
    console.log('App component rendered');
  }, []);

  return (
    <Router>
      <div className="App bg-gray-100 min-h-screen">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/play" element={<Game />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;