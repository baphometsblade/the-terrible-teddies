import React from 'react';
import { Routes, Route } from 'react-router-dom';
import { Toaster } from "@/components/ui/toaster";
import Auth from './components/Auth';
import TerribleTeddiesGame from './components/TerribleTeddiesGame';
import { useSupabaseAuth } from './hooks/useSupabaseAuth';

function App() {
  const { session } = useSupabaseAuth();

  return (
    <div className="App min-h-screen bg-gradient-to-b from-purple-100 to-pink-100">
      <Routes>
        <Route path="/" element={session ? <TerribleTeddiesGame /> : <Auth />} />
      </Routes>
      <Toaster />
    </div>
  );
}

export default App;