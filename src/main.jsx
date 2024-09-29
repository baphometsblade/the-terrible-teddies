import React from 'react'
import ReactDOM from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { SupabaseProvider } from './integrations/supabase/auth'
import App from './App.jsx'
import './index.css'
import ErrorBoundary from './components/ErrorBoundary'

const queryClient = new QueryClient()

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <SupabaseProvider>
          <App />
        </SupabaseProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  </React.StrictMode>,
)