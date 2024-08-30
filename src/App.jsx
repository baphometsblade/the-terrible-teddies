import React, { Suspense } from 'react';
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { navItems } from "./nav-items";
import { SupabaseProvider, useSupabaseAuth } from "./integrations/supabase/auth";
import { Loader2 } from 'lucide-react';
import { ErrorBoundary } from 'react-error-boundary';
import { Button } from '@/components/ui/button';

const queryClient = new QueryClient();

const ErrorFallback = ({ error, resetErrorBoundary }) => (
  <div className="flex flex-col items-center justify-center h-screen bg-red-50">
    <h2 className="text-2xl font-bold text-red-600 mb-4">Oops! Something went wrong</h2>
    <p className="text-gray-700 mb-4">{error.message}</p>
    <Button
      onClick={resetErrorBoundary}
      className="bg-red-500 hover:bg-red-600 text-white"
    >
      Try again
    </Button>
  </div>
);

const ProtectedRoute = ({ children }) => {
  const { session, loading } = useSupabaseAuth();

  if (loading) {
    return <div className="flex items-center justify-center h-screen"><Loader2 className="w-8 h-8 animate-spin" /></div>;
  }

  if (!session) {
    return <Navigate to="/auth" replace />;
  }

  return children;
};

const App = () => {
  const AuthComponent = navItems.find(item => item.to === "/auth")?.component;

  return (
    <ErrorBoundary FallbackComponent={ErrorFallback}>
      <SupabaseProvider>
        <QueryClientProvider client={queryClient}>
          <TooltipProvider>
            <Toaster />
            <BrowserRouter>
              <Suspense fallback={<div className="flex items-center justify-center h-screen"><Loader2 className="w-8 h-8 animate-spin" /></div>}>
                <Routes>
                  <Route path="/auth" element={AuthComponent ? <AuthComponent /> : null} />
                  {navItems.map(({ to, component: Component }) => (
                    to !== "/auth" && (
                      <Route 
                        key={to} 
                        path={to} 
                        element={
                          <ErrorBoundary FallbackComponent={ErrorFallback}>
                            <Suspense fallback={<div className="flex items-center justify-center h-screen"><Loader2 className="w-8 h-8 animate-spin" /></div>}>
                              <ProtectedRoute>
                                <Component />
                              </ProtectedRoute>
                            </Suspense>
                          </ErrorBoundary>
                        } 
                      />
                    )
                  ))}
                  <Route path="*" element={<Navigate to="/auth" replace />} />
                </Routes>
              </Suspense>
            </BrowserRouter>
          </TooltipProvider>
        </QueryClientProvider>
      </SupabaseProvider>
    </ErrorBoundary>
  );
};

export default App;
