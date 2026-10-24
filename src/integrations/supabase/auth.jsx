import { useState, useEffect, useCallback, createContext, useContext, lazy, Suspense } from 'react';
import { supabase } from '../../lib/supabase';
import DialogErrorBoundary from '@/components/DialogErrorBoundary';
import {
  landingRecord, withoutAuthError, recoveryLinkFailure, signInIntent,
} from '@/lib/authLanding';

// Only a reset email's landing draws it, so it is a chunk of its own (about
// 4 kB gzip with the helpers it shares with the forgot-password form, off
// everyone's first paint), fetched while supabase-js checks the link. Until it
// arrives nothing is drawn into #root, so index.html's loader stays up.
const PasswordRecovery = lazy(() => import('@/components/PasswordRecovery'));

const SupabaseAuthContext = createContext();

// Read once, at module load, before supabase-js has done anything with the
// address: it consumes a recovery link's tokens (and clears them from the
// URL) on its own, and announces PASSWORD_RECOVERY only once it has, a tick
// after the session it restored is already visible. Knowing from the first
// render that this load is a recovery means the game is never drawn for that
// tick, and a refused link (expired, already used) is caught at all: for
// those supabase-js raises no event, only leaves the error in the URL.
// Consumed when the reset flow ends, so a remount of the provider (the crash
// screen's Try Again) does not start it over.
const LANDING = landingRecord(typeof window !== 'undefined' ? window.location.href : '');

// The set-password panel, across a reload of its tab. supabase-js takes the
// recovery tokens out of the address as soon as it has used them, so a
// reload, or a phone discarding the tab while the player fetches a password
// from their password manager, dropped the panel and left them in the game,
// signed in by the link, with a password they did not know. Kept per tab
// (sessionStorage survives a reload and a discarded tab's restore, not a new
// tab) and for an hour, the life of the session the link signs in with.
// `uid` is the account the link signed in, once known.
const RESUME_KEY = 'terrible-teddies-recovery';
const RESUME_MS = 60 * 60 * 1000;
const readResume = () => {
  try {
    const r = JSON.parse(sessionStorage.getItem(RESUME_KEY) ?? 'null');
    const age = Date.now() - r?.at;
    return typeof r?.at === 'number' && age >= 0 && age < RESUME_MS ? r : null;
  } catch {
    return null;
  }
};
const writeResume = (r) => {
  try { sessionStorage.setItem(RESUME_KEY, JSON.stringify(r)); } catch { /* a convenience: without it, no resume */ }
};
const clearResume = () => {
  try { sessionStorage.removeItem(RESUME_KEY); } catch { /* as above */ }
};

// The reset panel's state:
//   null                                  the game (or the sign-in screen)
//   { stage: 'checking' }                 a recovery link is being checked
//   { stage: 'set-password' }             signed in by the link: choose a password
//                                         (`resumed`: after a reload of its tab)
//   { stage: 'link-error', reason }       'expired' (refused by Supabase),
//                                         'invalid' or 'offline' (could not be used)
const initialRecovery = () => {
  const landing = LANDING.landing;
  if (landing?.kind === 'recovery') return { stage: 'checking' };
  // otp_expired is what Supabase reports for a link past its time and for
  // one already used, and it comes with access_denied.
  if (landing?.kind === 'link-error') {
    return { stage: 'link-error', reason: ['otp_expired', 'access_denied'].includes(landing.code) ? 'expired' : 'invalid' };
  }
  if (!landing && readResume()) return { stage: 'set-password', resumed: true };
  return null;
};

export const SupabaseProvider = ({ children }) => {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [recovery, setRecovery] = useState(initialRecovery);
  // Where the sign-in screen should open: 'forgot' after an expired link's
  // "Send a new link". Read once by Auth (useAuthIntent), which clears it.
  const [authIntent, setAuthIntent] = useState(null);
  // A session arriving first (restored late, or signed in from another tab)
  // means Auth will not mount to read it; dropped, so it cannot open the
  // reset form unasked at the next sign-out.
  useEffect(() => {
    if (authIntent && signInIntent(authIntent, !!session) === null) setAuthIntent(null);
  }, [authIntent, session]);

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
      if (event === 'PASSWORD_RECOVERY' && LANDING.fromAuthLink) {
        // From "checking" (or, for a PKCE link, which this module cannot
        // read ahead, from nothing); never back over a later stage.
        setRecovery((r) => (r && r.stage !== 'checking' ? r : { stage: 'set-password' }));
      }
    });

    // A recovery link: once supabase-js has processed it, either it signed the
    // player in (set a password) or it could not. initialize() hands back the
    // same result the client's own start-up produced.
    const landing = LANDING.landing;
    if (landing?.kind === 'recovery') {
      // initialize() is documented never to reject; if it ever did, the
      // panel would wait on "Checking" for good, so a rejection reads as a
      // link that could not be checked.
      supabase.auth.initialize()
        .catch(() => ({ error: { name: 'AuthRetryableFetchError' } }))
        .then(({ error } = {}) => {
          if (!mounted) return;
          const reason = error ? recoveryLinkFailure(error) : null;
          // A dead token has no use in the address; one that could not be
          // checked stays, so a reload can try it again.
          if (reason === 'invalid') {
            window.history.replaceState(window.history.state, '', window.location.pathname + window.location.search);
          }
          setRecovery((r) => {
            if (r?.stage !== 'checking') return r;
            return reason ? { stage: 'link-error', reason } : { stage: 'set-password' };
          });
        });
    }
    // supabase-js leaves a refused link's error in the address.
    if (landing?.kind === 'link-error') {
      window.history.replaceState(window.history.state, '', withoutAuthError(window.location.href));
    }

    getSession();

    return () => {
      mounted = false;
      authListener?.subscription.unsubscribe();
    };
  }, []);

  // Note the panel while it is up, and the account it is for once the
  // session says (PASSWORD_RECOVERY can arrive a tick before it does).
  const recoveryUid = session?.user?.id ?? null;
  useEffect(() => {
    if (recovery?.stage !== 'set-password') return;
    const held = readResume();
    if (held && (held.uid || !recoveryUid)) return;
    writeResume({ at: held?.at ?? Date.now(), uid: recoveryUid });
  }, [recovery?.stage, recoveryUid]);

  // A resumed panel, once the session is restored: with no session there is
  // nothing to set a password on, so it says the link's session is over
  // (and offers a new link) before the player types one; a different
  // account in this tab is not the one the link was for.
  useEffect(() => {
    if (!recovery?.resumed || recovery.stage !== 'set-password' || loading) return;
    const held = readResume();
    if (!session) {
      clearResume();
      setRecovery({ stage: 'link-error', reason: 'expired' });
    } else if (held?.uid && held.uid !== session.user.id) {
      clearResume();
      setRecovery(null);
    }
  }, [recovery, loading, session]);

  const logout = async () => {
    await supabase.auth.signOut();
    setSession(null);
  };

  // Leave the reset panel: for the game (signed in), or for the sign-in
  // screen, opened on the reset form when `intent` is 'forgot'. This load's
  // landing has then done its work.
  const signedIn = !!session;
  const endRecovery = useCallback((intent = null) => {
    LANDING.consume();
    clearResume();
    setAuthIntent(signInIntent(intent, signedIn));
    setRecovery(null);
  }, [signedIn]);
  // Changed, or found dead when saving: either way the link has done all it
  // can, so a remount (or a reload) from here is an ordinary visit.
  const passwordSet = useCallback(() => {
    LANDING.consume();
    clearResume();
    setRecovery({ stage: 'done' });
  }, []);
  const linkExpired = useCallback(() => {
    LANDING.consume();
    clearResume();
    setRecovery({ stage: 'link-error', reason: 'expired' });
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
              signedIn={signedIn}
              restoring={loading}
              onPasswordSet={passwordSet}
              onLinkExpired={linkExpired}
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
