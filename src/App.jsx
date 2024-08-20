import React, { Suspense } from 'react';
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { navItems } from "./nav-items";
import { SupabaseProvider } from "./integrations/supabase/auth";
import { Loader2 } from 'lucide-react';

const queryClient = new QueryClient();

const App = () => (
  <SupabaseProvider>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <BrowserRouter>
          <Suspense fallback={<div className="flex items-center justify-center h-screen"><Loader2 className="w-8 h-8 animate-spin" /></div>}>
            <Routes>
              {navItems.map(({ to, page: PageComponent }) => (
                <Route 
                  key={to} 
                  path={to} 
                  element={
                    <Suspense fallback={<div className="flex items-center justify-center h-screen"><Loader2 className="w-8 h-8 animate-spin" /></div>}>
                      <PageComponent />
                    </Suspense>
                  } 
                />
              ))}
            </Routes>
          </Suspense>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </SupabaseProvider>
);

export default App;