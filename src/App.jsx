import React from 'react';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import { Toaster } from "@/components/ui/toaster";
import Home from './components/Home';
import Header from './components/Header';
import Game from './components/Game';
import Auth from './components/Auth';
import TeddyCollection from './components/TeddyCollection';
import Shop from './components/Shop';

function App() {
  return (
    <Router>
      <div className="App bg-gray-100 min-h-screen">
        <Header />
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/game" element={<Game />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/collection" element={<TeddyCollection />} />
          <Route path="/shop" element={<Shop />} />
        </Routes>
      </div>
      <Toaster />
    </Router>
  );
}

export default App;