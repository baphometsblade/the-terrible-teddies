import { useState, useEffect, useCallback, createContext, useContext, lazy, Suspense } from 'react';
import { supabase } from '../../lib/supabase';
import DialogErrorBoundary from '@/components/DialogErrorBoundary';
import {
  landingFromUrl, landedFromAuthLink, withoutAuthError, recoveryLinkFailure,
} from '@/lib/authLanding';

// Only a reset email's landing draws it, so it is a chunk of its own (about
// 2 kB gzip off everyone's first paint), fetched while supabase-js checks the
// link. Until it arrives nothing is drawn into #root, so index.html's loader
// stays up.
const PasswordRecovery = lazy(() => import('@/components/PasswordRecovery'));

const SupabaseAuthContext = createContext();

// Read once, at module load, before supabase-js has done anything with the
// address: it consumes a recovery link's tokens (and clears them from the
// URL) on its own, and announces PASSWORD_RECOVERY only once it has, a tick
// after the session it restored is already visible. Knowing from the first
// render that this load is a recovery means the game is never drawn for that
// tick, and a refused link (expired, already used) is caught at all: for
// those supabase-js raises no event, only leaves the error in the URL.
const LANDING_HREF = typeof window !== 'undefined' ? window.location.href : '';
const LANDING = landingFromUrl(LANDING_HREF);
const FROM_AUTH_LINK = landedFromAuthLink(LANDING_HREF);

// The reset panel's state:
//   null                                  the game (or the sign-in screen)
//   { stage: 'checking' }                 a recovery link is being checked
//   { stage: 'set-password' }             signed in by the link: choose a password
//   { stage: 'link-error', reason }       'expired' (refused by Supabase),
//                                         'invalid' or 'offline' (could not be used)
const initialRecovery = () => {
  if (LANDING?.kind === 'recovery') return { stage: 'checking' };
  // otp_expired is what Supabase reports for a link past its time and for
  // one already used, and it comes with access_denied.
  if (LANDING?.kind === 'link-error') {
    return { stage: 'link-error', reason: ['otp_expired', 'access_denied'].includes(LANDING.code) ? 'expired' : 'invalid' };
  }
  return null;
};

export const SupabaseProvider = ({ children }) => {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [recovery, setRecovery] = useState(initialRecovery);
  // Where the sign-in screen should open: 'forgot' after an expired link's
  // "Send a new link". Read once by Auth (consumeAuthIntent).
  const [authIntent, setAuthIntent] = useState(null);

  useEffect(() => {
    let mounted = true;
    const getSession = async () => {
      setLoading(true);
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (mounted) setSession(session);
      } catch (error) {
        // A rejection here used to strand `loading` at true forever, and the
        // app's boot gate renders on exactly that flag — so the player would
        // sit on the loading screen for the rest of the session with no error
        // and no way out. supabase-js resolves rather than throws for the
        // ordinary offline case (it retries internally and then hands back a
        // null session), but "the one await that can never be allowed to
        // reject" deserves better than an assumption about someone else's
        // error contract. Treat a throw as "not signed in": the login screen
        // is at least a screen the player can act on.
        console.error('Failed to restore session:', error);
        if (mounted) setSession(null);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session);
      // Only in the tab the email link opened: supabase-js relays auth events
      // to the game's other open tabs, which must stay where they are.
      if (event === 'PASSWORD_RECOVERY' && FROM_AUTH_LINK) {
        setRecovery((r) => (r?.stage === 'set-password' ? r : { stage: 'set-password' }));
      }
    });

    // A recovery link: once supabase-js has processed it, either it signed the
    // player in (set a password) or it could not. initialize() hands back the
    // same result the client's own start-up produced.
    if (LANDING?.kind === 'recovery') {
      supabase.auth.initialize().then(({ error } = {}) => {
        if (!mounted) return;
        setRecovery((r) => {
          if (r?.stage !== 'checking') return r;
          if (!error) return { stage: 'set-password' };
          const reason = recoveryLinkFailure(error);
          // A dead token has no use in the address; one that could not be
          // checked stays, so a reload can try it again.
          if (reason === 'invalid') window.history.replaceState(window.history.state, '', window.location.pathname + window.location.search);
          return { stage: 'link-error', reason };
        });
      });
    }
    // supabase-js leaves a refused link's error in the address.
    if (LANDING?.kind === 'link-error') {
      window.history.replaceState(window.history.state, '', withoutAuthError(window.location.href));
    }

    getSession();

    return () => {
      mounted = false;
      authListener?.subscription.unsubscribe();
    };
  }, []);

  const logout = async () => {
    await supabase.auth.signOut();
    setSession(null);
  };

  // Leave the reset panel: for the game (signed in), or for the sign-in
  // screen, opened on the reset form when `intent` is 'forgot'.
  const endRecovery = useCallback((intent = null) => {
    setAuthIntent(intent);
    setRecovery(null);
  }, []);
  const clearAuthIntent = useCallback(() => setAuthIntent(null), []);

  const value = {
    session,
    loading,
    logout,
    recovery,
    authIntent,
    clearAuthIntent,
  };

  return (
    <SupabaseAuthContext.Provider value={value}>
      {/* The reset panel stands in for the whole game, not over it: the game
          would otherwise boot underneath (Daily Rewards, the tutorial, the
          menu), each wanting the keyboard. It is only ever reached from a
          fresh load, so nothing the player was doing is lost. */}
      {recovery ? (
        // A chunk that fails to arrive is a dismissible notice that lets the
        // game start, not the app-wide crash screen.
        <DialogErrorBoundary resetKey={recovery.stage} onDismiss={() => endRecovery()}>
          <Suspense fallback={null}>
            <PasswordRecovery
              recovery={recovery}
              signedIn={!!session}
              onPasswordSet={() => setRecovery({ stage: 'done' })}
              onLinkExpired={() => setRecovery({ stage: 'link-error', reason: 'expired' })}
              onDone={endRecovery}
            />
          </Suspense>
        </DialogErrorBoundary>
      ) : children}
    </SupabaseAuthContext.Provider>
  );
};

export const useSupabaseAuth = () => {
  const context = useContext(SupabaseAuthContext);
  if (context === undefined) {
    throw new Error('useSupabaseAuth must be used within a SupabaseAuthProvider');
  }
  return context;
};

const NO_INTENT = [null, () => {}];

/**
 * [intent, clear]: where the sign-in screen should open ('forgot', or null).
 * Auth reads it as it mounts and clears it, so a later sign-in screen (after
 * signing out) opens as usual. Outside the provider there is none.
 */
export const useAuthIntent = () => {
  const context = useContext(SupabaseAuthContext);
  return context ? [context.authIntent, context.clearAuthIntent] : NO_INTENT;
};

export const SupabaseAuthProvider = SupabaseProvider;
