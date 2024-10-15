import React from 'react';
import { useSupabaseAuth } from './hooks/useSupabaseAuth';
import Auth from './components/Auth';
import TerribleTeddiesGame from './components/TerribleTeddiesGame';
import { Toaster } from "@/components/ui/toaster";

function App() {
  const { session } = useSupabaseAuth();

  console.log('App component rendering, session:', session);

  return (
    <div className="App min-h-screen bg-gradient-to-b from-purple-100 to-pink-100">
      {session ? <TerribleTeddiesGame /> : <Auth />}
      <Toaster />
    </div>
  );
}

export default App;