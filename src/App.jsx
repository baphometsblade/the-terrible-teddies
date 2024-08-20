import React, { Suspense } from 'react';
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { navItems } from "./nav-items";
import { SupabaseProvider } from "./integrations/supabase/auth";
import { Loader2 } from 'lucide-react';
import { ErrorBoundary } from 'react-error-boundary';

const queryClient = new QueryClient();

const ErrorFallback = ({ error }) => (
  <div className="flex flex-col items-center justify-center h-screen">
    <h2 className="text-2xl font-bold text-red-600 mb-4">Oops! Something went wrong</h2>
    <p className="text-gray-700 mb-4">{error.message}</p>
    <button
      className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
      onClick={() => window.location.reload()}
    >
      Reload page
    </button>
  </div>
);

const App = () => (
  <ErrorBoundary FallbackComponent={ErrorFallback}>
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
                      <ErrorBoundary FallbackComponent={ErrorFallback}>
                        <Suspense fallback={<div className="flex items-center justify-center h-screen"><Loader2 className="w-8 h-8 animate-spin" /></div>}>
                          <PageComponent />
                        </Suspense>
                      </ErrorBoundary>
                    } 
                  />
                ))}
              </Routes>
            </Suspense>
          </BrowserRouter>
        </TooltipProvider>
      </QueryClientProvider>
    </SupabaseProvider>
  </ErrorBoundary>
);

export default App;