import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { SupabaseProvider } from './integrations/supabase/auth'
import App from './App.jsx'
import './index.css'

const queryClient = new QueryClient()

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <SupabaseProvider>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </SupabaseProvider>
    </QueryClientProvider>
  </React.StrictMode>,
)