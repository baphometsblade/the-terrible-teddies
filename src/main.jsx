import React, { lazy, Suspense } from 'react'
import ReactDOM from 'react-dom/client'
import { MotionConfig } from 'framer-motion'
import App from './App.jsx'
import '@fontsource/baloo-2/latin-600.css'
import '@fontsource/baloo-2/latin-800.css'
import './index.css'
import { useGameStore } from './stores/gameStore'
import { registerShell } from './lib/pwa'
import ErrorBoundary from './components/ErrorBoundary'
import OfflineNotice from './components/OfflineNotice'
import DoorGate from './components/DoorGate'
import FrontOfHouse from './components/FrontOfHouse'
import ConsentNotice from './components/ConsentNotice'
import BackendNotice from './components/BackendNotice'
import PlatformRuntime from './components/PlatformRuntime'
import { legalKind } from './lib/legalRoutes'
import { isAdminPath } from './lib/publicPaths'
import { installProductObservers } from './lib/productEvents'
import { SupabaseProvider } from './integrations/supabase/auth'

const LegalPage = lazy(() => import('./components/LegalPage'))
const AdminDashboard = lazy(() => import('./components/AdminDashboard'))

installProductObservers()
// The static landing is for browsers that do not run JavaScript. Once React
// is up it would sit in the document as a second set of links, which a
// turned-away device is not supposed to have.
document.getElementById('seo-landing')?.remove()

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
// Text size, colourblind rarity and the table cloth. On <html>, so a
// stylesheet can see them without every card subscribing to the store.
function LookPrefs() {
  const textSize = useGameStore((s) => s.textSize);
  const colorblindSafe = useGameStore((s) => s.colorblindSafe);
  const board = useGameStore((s) => s.equippedBoard);
  React.useEffect(() => {
    const root = document.documentElement;
    root.dataset.text = textSize === 'large' || textSize === 'larger' ? textSize : 'default';
    root.dataset.cb = colorblindSafe ? 'safe' : 'full';
    if (board && board !== 'house-board') root.dataset.board = board;
    else delete root.dataset.board;
  }, [textSize, colorblindSafe, board]);
  return null;
}

function MotionPreference({ children }) {
  const animationsEnabled = useGameStore((s) => s.animationsEnabled);
  // MotionConfig reaches Framer Motion only. The foil and sheen effects are
  // CSS (compositor-only, see index.css), so mirror the switch onto <html>
  // where a stylesheet can see it; [data-motion="off"] stops them.
  React.useEffect(() => {
    document.documentElement.dataset.motion = animationsEnabled ? 'on' : 'off';
  }, [animationsEnabled]);
  return (
    <MotionConfig reducedMotion={animationsEnabled ? 'user' : 'always'}>
      {children}
    </MotionConfig>
  );
}

try {
  // Analytics start in the door (DoorGate), once a device has been let in: a
  // player under 18 never loads the SDK. They used to start here, before
  // anything was drawn.
  const root = ReactDOM.createRoot(document.getElementById('root'));

  registerShell();

  root.render(
    <React.StrictMode>
      <ErrorBoundary>
        <MotionPreference>
          <LookPrefs />
          {/* Outside the door and the session, so a signed-out player and a
              player still at the age gate hear it too. It renders nothing
              while the device is online. */}
          <OfflineNotice />
          {/* No BrowserRouter and no QueryClientProvider. Neither had a
              consumer: there is no Route, Link, useNavigate or useParams
              anywhere — navigation is the `currentScreen` state in App — and
              no useQuery either, so the query client existed only so auth.jsx
              could invalidate a key nothing had ever registered. Two runtime
              dependencies on the boot path, doing nothing.

              The door gates all of it, the password-reset landing included
              (see DoorGate). For a device that has been let in it renders
              its children and nothing else, so what follows is the game as
              it always was. */}
          {legalKind(window.location.pathname) ? (
            <Suspense fallback={null}>
              <LegalPage kind={legalKind(window.location.pathname)} />
            </Suspense>
          ) : (
            <FrontOfHouse>
              <DoorGate>
                <SupabaseProvider>
                  <ConsentNotice />
                  <BackendNotice />
                  <PlatformRuntime />
                  {isAdminPath(window.location.pathname) ? (
                    <Suspense fallback={null}>
                      <AdminDashboard />
                    </Suspense>
                  ) : (
                    <App />
                  )}
                </SupabaseProvider>
              </DoorGate>
            </FrontOfHouse>
          )}
        </MotionPreference>
      </ErrorBoundary>
    </React.StrictMode>
  );
} catch (error) {
  console.error('Error in main.jsx:', error);
}