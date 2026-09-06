import React from 'react'
import ReactDOM from 'react-dom/client'
import { MotionConfig } from 'framer-motion'
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

  const root = ReactDOM.createRoot(document.getElementById('root'));

  root.render(
    <React.StrictMode>
      <ErrorBoundary>
        <MotionPreference>
          {/* No BrowserRouter and no QueryClientProvider. Neither had a
              consumer: there is no Route, Link, useNavigate or useParams
              anywhere — navigation is the `currentScreen` state in App — and
              no useQuery either, so the query client existed only so auth.jsx
              could invalidate a key nothing had ever registered. Two runtime
              dependencies on the boot path, doing nothing. */}
          <SupabaseProvider>
            <App />
          </SupabaseProvider>
        </MotionPreference>
      </ErrorBoundary>
    </React.StrictMode>
  );
} catch (error) {
  console.error('Error in main.jsx:', error);
}