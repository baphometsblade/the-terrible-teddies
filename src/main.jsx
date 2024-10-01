import React from 'react'
import ReactDOM from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter as Router } from 'react-router-dom'
import App from './App.jsx'
import './index.css'
import { SupabaseProvider } from './integrations/supabase/auth'
import { initPostHog } from './utils/posthog'

const queryClient = new QueryClient()

// Conditionally initialize PostHog
if (import.meta.env.VITE_POSTHOG_KEY) {
  initPostHog().catch(console.error);
} else {
  console.warn('PostHog key not found in environment variables');
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <SupabaseProvider>
        <Router>
          <App />
        </Router>
      </SupabaseProvider>
    </QueryClientProvider>
  </React.StrictMode>,
)