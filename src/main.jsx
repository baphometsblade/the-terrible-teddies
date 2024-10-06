import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import App from './App.jsx'
import './index.css'
import { initializePostHog } from './utils/analytics.js'
import { initializeErrorReporting } from './utils/errorReporting.js'
import ErrorBoundary from './components/ErrorBoundary'

console.log('Main.jsx is starting execution');

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
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </QueryClientProvider>
    </ErrorBoundary>
  </React.StrictMode>
);

console.log('React app rendered');