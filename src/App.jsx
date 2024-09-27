import React from 'react';
import { Routes, Route } from 'react-router-dom';
import Index from './pages/Index';

function App() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-purple-900 to-indigo-900 text-white">
      <Routes>
        <Route path="/" element={<Index />} />
      </Routes>
    </div>
  );
}

export default App;