import React, { useEffect, useState } from 'react';
import { Toaster } from "@/components/ui/toaster";
import Game from './components/Game';
import { SupabaseProvider } from './integrations/supabase/auth';
import { initPostHog, captureEvent } from './utils/posthog';
import { initSupabase, setupTerribleTeddies } from './lib/supabase';

function App() {
  const [isSupabaseReady, setIsSupabaseReady] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const initializeApp = async () => {
      console.log('Initializing app...');
      try {
        initPostHog();
        captureEvent('App_Loaded');
        console.log('PostHog initialized');

        const supabaseInitialized = await initSupabase();
        console.log('Supabase initialization result:', supabaseInitialized);
        
        if (supabaseInitialized) {
          const setupResult = await setupTerribleTeddies();
          console.log('Terrible Teddies setup result:', setupResult);
          setIsSupabaseReady(true);
        } else {
          setError('Failed to initialize Supabase');
        }
      } catch (error) {
        console.error('Error during app initialization:', error);
        setError(error.message);
      }
    };

    initializeApp();
  }, []);

  console.log('App rendering, isSupabaseReady:', isSupabaseReady);

  if (error) {
    return <div>Error: {error}</div>;
  }

  if (!isSupabaseReady) {
    return <div>Loading... Please check the console for any error messages.</div>;
  }

  return (
    <SupabaseProvider>
      <div className="container mx-auto p-4">
        <h1 className="text-3xl font-bold mb-4">Terrible Teddies</h1>
        <Game />
      </div>
      <Toaster />
    </SupabaseProvider>
  );
}

export default App;