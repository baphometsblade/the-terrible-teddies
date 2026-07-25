import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { MotionConfig } from 'framer-motion'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import App from './App.jsx'
import '@fontsource/baloo-2/latin-600.css'
import '@fontsource/baloo-2/latin-800.css'
import './index.css'
import { initializePostHog } from './utils/analytics.js'
import ErrorBoundary from './components/ErrorBoundary'
import { SupabaseProvider } from './integrations/supabase/auth'

try {
  initializePostHog();

  const queryClient = new QueryClient()
  const root = ReactDOM.createRoot(document.getElementById('root'));

  root.render(
    <React.StrictMode>
      <ErrorBoundary>
        {/* Honor the OS "reduce motion" preference for every Framer Motion
            animation at once — an accessibility win for users with vestibular
            sensitivity, and it also removes the continuous-animation CPU load
            under headless test runs. Users without the preference are
            unaffected (full animations). */}
        <MotionConfig reducedMotion="user">
          <QueryClientProvider client={queryClient}>
            <SupabaseProvider>
              <BrowserRouter>
                <App />
              </BrowserRouter>
            </SupabaseProvider>
          </QueryClientProvider>
        </MotionConfig>
      </ErrorBoundary>
    </React.StrictMode>
  );
} catch (error) {
  console.error('Error in main.jsx:', error);
}