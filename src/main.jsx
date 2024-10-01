import React from 'react'
import ReactDOM from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter as Router } from 'react-router-dom'
import App from './App.jsx'
import './index.css'
import { SupabaseProvider } from './integrations/supabase/auth'
import { initPostHog } from './utils/posthog'

const queryClient = new QueryClient()

initPostHog();

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