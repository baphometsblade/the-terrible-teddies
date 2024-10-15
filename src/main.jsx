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

console.log('Main.jsx is starting execution');

try {
  initializePostHog();
  console.log('PostHog initialized');

  initializeErrorReporting();
  console.log('Error reporting initialized');

  const queryClient = new QueryClient()
  console.log('QueryClient created');

  const root = ReactDOM.createRoot(document.getElementById('root'));
  console.log('React root created');

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

  console.log('React app rendered');
} catch (error) {
  console.error('Error in main.jsx:', error);
}