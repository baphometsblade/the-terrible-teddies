import React from 'react';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import { Toaster } from "@/components/ui/toaster";
import Home from './components/Home';
import Battle from './components/Battle';
import TeddyCollection from './components/TeddyCollection';
import Shop from './components/Shop';
import Header from './components/Header';

function App() {
  return (
    <Router>
      <div className="App bg-gray-100 min-h-screen">
        <Header />
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/battle" element={<Battle />} />
          <Route path="/collection" element={<TeddyCollection />} />
          <Route path="/shop" element={<Shop />} />
        </Routes>
      </div>
      <Toaster />
    </Router>
  );
}

export default App;