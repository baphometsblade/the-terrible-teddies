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
import { useGameStore } from './stores/gameStore'
import ErrorBoundary from './components/ErrorBoundary'
import { SupabaseProvider } from './integrations/supabase/auth'

// Honors BOTH the OS "reduce motion" preference and the in-game Animations
// switch, for every Framer Motion animation at once.
//
// The store already had `animationsEnabled` wired to a Settings toggle, but
// NOTHING read it — grep found zero consumers, so the switch a player flipped
// to calm the screen down (or to reclaim CPU on a weak phone) did precisely
// nothing. Feeding it into MotionConfig makes it real everywhere in one place,
// rather than threading a flag through every animated component.
//
// A selector subscription, not the bare hook: this sits above the entire tree,
// so subscribing to the whole store would re-render the app on every coin.
function MotionPreference({ children }) {
  const animationsEnabled = useGameStore((s) => s.animationsEnabled);
  return (
    <MotionConfig reducedMotion={animationsEnabled ? 'user' : 'always'}>
      {children}
    </MotionConfig>
  );
}

try {
  initializePostHog();

  const queryClient = new QueryClient()
  const root = ReactDOM.createRoot(document.getElementById('root'));

  root.render(
    <React.StrictMode>
      <ErrorBoundary>
        <MotionPreference>
          <QueryClientProvider client={queryClient}>
            <SupabaseProvider>
              <BrowserRouter>
                <App />
              </BrowserRouter>
            </SupabaseProvider>
          </QueryClientProvider>
        </MotionPreference>
      </ErrorBoundary>
    </React.StrictMode>
  );
} catch (error) {
  console.error('Error in main.jsx:', error);
}