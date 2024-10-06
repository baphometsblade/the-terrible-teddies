import React, { useEffect, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from "@/components/ui/toaster";
import ErrorBoundary from './components/ErrorBoundary';
import Game from './components/Game';
import { SupabaseProvider } from './integrations/supabase/auth';
import { initPostHog, captureEvent } from './utils/posthog';
import { initSupabase, setupTerribleTeddies } from './lib/supabase';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      refetchOnWindowFocus: false,
    },
  },
});

function App() {
  const [isSupabaseReady, setIsSupabaseReady] = useState(false);

  useEffect(() => {
    const initializeApp = async () => {
      initPostHog();
      captureEvent('App_Loaded');
      console.log('App component mounted');

      const supabaseInitialized = await initSupabase();
      if (supabaseInitialized) {
        await setupTerribleTeddies();
        setIsSupabaseReady(true);
      } else {
        console.error('Failed to initialize Supabase');
      }
    };

    initializeApp();
  }, []);

  if (!isSupabaseReady) {
    return <div>Loading...</div>;
  }

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <SupabaseProvider>
          <div className="container mx-auto p-4">
            <h1 className="text-3xl font-bold mb-4">Terrible Teddies</h1>
            <Game />
          </div>
          <Toaster />
        </SupabaseProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;