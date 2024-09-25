import React, { useEffect } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from "@/components/ui/sonner";
import { SupabaseProvider } from './integrations/supabase';
import Index from './pages/Index';
import { setupTerribleTeddies } from './utils/supabaseSetup';

const queryClient = new QueryClient();

const App = () => {
  useEffect(() => {
    setupTerribleTeddies();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <SupabaseProvider>
        <Toaster />
        <Index />
      </SupabaseProvider>
    </QueryClientProvider>
  );
};

export default App;
