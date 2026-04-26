import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import App from './App.jsx'
import './index.css'
import { initializePostHog } from './utils/analytics.js'
import { initializeErrorReporting } from './utils/errorReporting.js'
import ErrorBoundary from './components/ErrorBoundary'
import { SupabaseProvider } from './integrations/supabase/auth'

try {
  initializePostHog();
  initializeErrorReporting();

  const queryClient = new QueryClient()
  const root = ReactDOM.createRoot(document.getElementById('root'));

  root.render(
    <React.StrictMode>
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <SupabaseProvider>
            <BrowserRouter>
              <App />
            </BrowserRouter>
          </SupabaseProvider>
        </QueryClientProvider>
      </ErrorBoundary>
    </React.StrictMode>
  );
} catch (error) {
  console.error('Error in main.jsx:', error);
}