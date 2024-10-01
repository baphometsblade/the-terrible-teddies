import React, { useEffect, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { initSupabase } from './lib/supabase';
import Game from './components/Game';
import ErrorBoundary from './components/ErrorBoundary';
import { useToast } from "@/components/ui/use-toast";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function App() {
  const [isSupabaseInitialized, setIsSupabaseInitialized] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    const init = async () => {
      try {
        const initialized = await initSupabase();
        setIsSupabaseInitialized(initialized);
        if (!initialized) {
          toast({
            title: "Initialization Error",
            description: "Failed to connect to the database. Please try again later.",
            variant: "destructive",
          });
        }
      } catch (error) {
        console.error('Initialization error:', error);
        toast({
          title: "Initialization Error",
          description: error.message,
          variant: "destructive",
        });
      }
    };
    init();
  }, [toast]);

  if (!isSupabaseInitialized) {
    return <div>Initializing application...</div>;
  }

  return (
    <QueryClientProvider client={queryClient}>
      <ErrorBoundary>
        <div className="App">
          <Game />
        </div>
      </ErrorBoundary>
    </QueryClientProvider>
  );
}

export default App;