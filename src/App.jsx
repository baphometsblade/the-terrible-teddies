import React from 'react';
import { useSupabaseAuth } from './hooks/useSupabaseAuth';
import Auth from './components/Auth';
import GameBoard from './components/GameBoard/GameBoard';
import { Toaster } from "@/components/ui/toaster";
import ErrorBoundary from './components/ErrorBoundary';

function App() {
  const { session, loading } = useSupabaseAuth();

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <ErrorBoundary>
      <div className="App min-h-screen bg-gradient-to-b from-purple-100 to-pink-100">
        {session ? (
          <React.Suspense fallback={<div>Loading game...</div>}>
            <GameBoard />
          </React.Suspense>
        ) : (
          <Auth />
        )}
        <Toaster />
      </div>
    </ErrorBoundary>
  );
}

export default App;