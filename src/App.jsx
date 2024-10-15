import React from 'react';
import { Routes, Route } from 'react-router-dom';
import { Toaster } from "@/components/ui/toaster";
import Auth from './components/Auth';
import TerribleTeddiesGame from './components/TerribleTeddiesGame';
import { useSupabaseAuth } from './hooks/useSupabaseAuth';

function App() {
  const { session } = useSupabaseAuth();

  return (
    <div className="App container mx-auto px-4 py-8">
      <h1 className="text-4xl font-bold mb-8 text-center">Terrible Teddies</h1>
      <Routes>
        <Route path="/" element={session ? <TerribleTeddiesGame /> : <Auth />} />
      </Routes>
      <Toaster />
    </div>
  );
}

export default App;