import React from 'react';
import { useSupabaseAuth } from './hooks/useSupabaseAuth';
import Auth from './components/Auth';
import TerribleTeddiesGame from './components/TerribleTeddiesGame';
import { Toaster } from "@/components/ui/toaster";
import ErrorBoundary from './components/ErrorBoundary';

function App() {
  const { session, loading } = useSupabaseAuth();

  console.log('App component rendering, session:', session, 'loading:', loading);

  if (loading) {
    console.log('Auth is still loading');
    return <div>Loading...</div>;
  }

  return (
    <ErrorBoundary>
      <div className="App min-h-screen bg-gradient-to-b from-purple-100 to-pink-100">
        {session ? (
          <React.Suspense fallback={<div>Loading game...</div>}>
            <TerribleTeddiesGame />
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