import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { Mail, LockKeyhole, LogIn, UserPlus, LoaderCircle } from 'lucide-react';
import { supabase } from '../utils/supabaseClient';
import { RARITY_METAL } from '@/lib/rarity';
import { FOCUS_RING } from '@/lib/focus';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { useAuthIntent } from '@/integrations/supabase/auth';
import { PASSWORD_MIN_LENGTH } from '@/lib/authLanding';
import { ALL_CARDS } from '../stores/gameStore';
import CardFan from './CardFan';
import DialogErrorBoundary from './DialogErrorBoundary';
import { AuthAlert, AuthField, AUTH_ACTION, busyLook, CheckEmailPanel } from './AuthField';

// The reset form is a chunk of its own: this screen is on everyone's first
// paint, and few visitors ever open it. Fetched as the pointer or the focus
// reaches "Forgot password?", so it is usually there before the tap.
const loadForgotPassword = () => import('./ForgotPassword');
const ForgotPassword = lazy(loadForgotPassword);
// A prefetch that fails says nothing: the tap's own load reports it.
const prefetchForgotPassword = () => { loadForgotPassword().catch(() => {}); };

// The key art beside the form from lg up: three of the set's best-dressed,
// fanned as the main menu fans a player's own (the legendary in the centre).
// Resolved by name, so ids and the shipped art stay canonical.
const KEY_ART = ['Mama Mauls', 'The Godfluffer', 'Duke of Dumpsterfire']
  .map((name) => ALL_CARDS.find((c) => c.name === name))
  .filter(Boolean);

// The fields, the two actions and their busy look are shared with the reset
// form and the set-new-password panel (AuthField.jsx), which says why each
// is drawn the way it is.

// What a failed sign-in or sign-up says. The server's own words for a refusal
// ("Invalid login credentials"); for a request that got no answer at all,
// which supabase-js reports as an AuthRetryableFetchError rather than
// throwing, the reset form's words (resetRequestOutcome) instead of
// "Failed to fetch".
const OFFLINE = "Couldn't reach the server. Check your connection and try again.";
const requestErrorText = (error) => (error?.name === 'AuthRetryableFetchError' || !error?.message ? OFFLINE : error.message);

const Auth = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loadingAction, setLoadingAction] = useState(null); // 'signin' | 'signup' | null
  // What sign-in or sign-up came back with, said under the buttons until the
  // player types again. These were toasts, gone in five seconds: a player
  // who looked away from a failed sign-in saw an unchanged form.
  const [formError, setFormError] = useState(null);
  // The address a sign-up is waiting on a confirmation for. The form gives
  // way to "Check your email" (the reset form's panel), which stays until
  // the player goes back; it was a toast too, and once it had gone the
  // screen gave no sign the account was made or what to do next.
  const [signedUpAs, setSignedUpAs] = useState(null);
  // 'signin' (sign in or sign up) or 'forgot' (ask for a reset link). An
  // expired reset link's "Send a new link" opens it on 'forgot'.
  const [authIntent, clearAuthIntent] = useAuthIntent();
  const [mode, setMode] = useState(() => (authIntent === 'forgot' ? 'forgot' : 'signin'));
  useEffect(() => { if (authIntent) clearAuthIntent(); }, [authIntent, clearAuthIntent]);
  // Back from the reset form or the sign-up panel, focus returns to the
  // control that opened it.
  const forgotRef = useRef(null);
  const signUpRef = useRef(null);
  const passwordRef = useRef(null);
  const returning = useRef(null); // the ref to focus on the way back
  useEffect(() => {
    if (mode === 'signin' && !signedUpAs && returning.current) {
      const to = returning.current;
      returning.current = null;
      to.current?.focus();
    }
  }, [mode, signedUpAs]);

  // Typing again clears what the last attempt said.
  const changeField = (setter) => (e) => {
    setter(e.target.value);
    setFormError(null);
  };
  // Only where there is room beside the form: the fan and the form side by
  // side need about 800px. On a phone the form already runs most of the
  // screen's height, and art above it would push Sign In below the fold.
  // Not rendered at all where it does not show, so its images are not fetched.
  const wide = useMediaQuery('(min-width: 1024px)');

  const handleSignUp = async (e) => {
    e.preventDefault();
    // Sign Up is not the form's submit button, so the browser's own checks
    // (required, at least 6 characters) never ran for it, and an empty form
    // just ignored the click. Ask for them: the browser points at the field.
    const form = e.currentTarget.form;
    if (form && !form.reportValidity()) return;
    if (!email || !password) return;
    setLoadingAction('signup');
    setFormError(null);
    try {
      const { data, error } = await supabase.auth.signUp({ email, password });
      if (error) {
        setFormError(requestErrorText(error));
      } else if (!data?.session) {
        // The server wants the address confirmed first. (With confirmation
        // off it signs the player straight in, and the auth listener takes
        // them on to the game; there is nothing to say here.)
        setSignedUpAs(email.trim());
      }
    } catch {
      setFormError(OFFLINE);
    } finally {
      setLoadingAction(null);
    }
  };

  const handleSignIn = async (e) => {
    e.preventDefault();
    if (!email || !password) return;
    setLoadingAction('signin');
    setFormError(null);
    let failed = false;
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setFormError(requestErrorText(error));
        failed = true;
      }
    } catch {
      setFormError(OFFLINE);
      failed = true;
    } finally {
      setLoadingAction(null);
    }
    // Into the password, selected, so it can be typed again at once (the
    // button had the focus, and was disabled while the request ran).
    if (failed) {
      requestAnimationFrame(() => {
        passwordRef.current?.focus();
        passwordRef.current?.select();
      });
    }
  };

  return (
    <div className="relative min-h-screen bar-backdrop flex flex-col items-center justify-center px-4 py-10 sm:py-14 overflow-x-hidden">
      <div className="fixed inset-0 grain pointer-events-none" aria-hidden="true" />

      {/* main, so the title block below is a plain header inside it rather
          than a lone banner landmark with the form outside every landmark.
          From lg it is two columns: the card fan, spanning both rows, beside
          the title over the form. */}
      <main className="relative w-full max-w-md lg:max-w-none lg:w-auto lg:grid lg:grid-cols-[270px_28rem] lg:items-center lg:gap-x-20">
        {wide && (
          <CardFan
            cards={KEY_ART}
            className="row-span-2 w-[270px] h-[236px]"
            cardClassName="scale-[1.5]"
            artLoading="eager"
          />
        )}
        {/* Title card: the brass medallion the boot screen turns around, so
            loading and signing in read as the same place. */}
        <header className="flex flex-col items-center text-center mb-8">
          <div className="relative grid h-24 w-24 place-items-center mb-5" aria-hidden="true">
            <div className="absolute -inset-10 rounded-full bg-[radial-gradient(closest-side,rgba(251,191,36,0.18),transparent)]" />
            <div
              className="relative h-20 w-20 rounded-full p-[3px] shadow-[0_14px_30px_-12px_rgba(0,0,0,0.9)]"
              style={{ background: RARITY_METAL.legendary }}
            >
              <div className="grid h-full w-full place-items-center rounded-full bg-night-900 text-[2.5rem]">🧸</div>
            </div>
          </div>
          {/* text-5xl wraps below 375px, and a gradient clipped to text then
              stretches over both lines: one word pale, the other dark. */}
          <h1 className="font-display font-extrabold text-[2.5rem] min-[375px]:text-5xl sm:text-6xl leading-none tracking-tight whitespace-nowrap text-brass-gradient">
            Terrible Teddies
          </h1>
          <p className="mt-3 font-display text-lg font-semibold leading-snug text-plush-200">
            Stuffed animals. Unstuffed grudges.
          </p>
          {/* The content rating, set like the one on a box: a stamped badge
              and the small print beside it. Here, before the form, so it is
              read (and on a short screen, seen) before anyone signs up. */}
          <p className="mt-4 max-w-sm text-xs leading-relaxed text-plush-300">
            <span className="inline-block rounded-[5px] border border-brass-300/50 px-1.5 py-px font-display text-[11px] font-extrabold leading-[1.1rem] text-brass-200 align-[1px]">18+</span>
            {' '}— contains profanity, cartoon fluff violence, and bears with substance-abuse issues.
          </p>
        </header>

        <div className="relative dialog-panel rounded-2xl px-5 py-6 sm:px-8 sm:py-8 overflow-hidden">
          {/* Lamplight over the counter. */}
          <div aria-hidden="true" className="absolute inset-x-0 top-0 h-32 pointer-events-none bg-[radial-gradient(ellipse_60%_100%_at_50%_0%,rgba(251,191,36,0.1),transparent_70%)]" />

          {mode === 'forgot' ? (
            <DialogErrorBoundary resetKey={mode} onDismiss={() => setMode('signin')}>
              <Suspense fallback={<p role="status" className="relative py-16 text-center label-caps text-plush-300">Loading</p>}>
                <ForgotPassword
                  email={email}
                  onEmailChange={setEmail}
                  onBack={() => { returning.current = forgotRef; setMode('signin'); }}
                />
              </Suspense>
            </DialogErrorBoundary>
          ) : signedUpAs ? (
            <CheckEmailPanel onBack={() => { returning.current = signUpRef; setSignedUpAs(null); }}>
              If <strong className="font-semibold text-white [overflow-wrap:anywhere]">{signedUpAs}</strong> is new here,
              we&apos;ve sent it a link to confirm your account. Open it, then sign in. If nothing arrives in a few
              minutes, check your spam folder; if that address already has an account, sign in with its password.
            </CheckEmailPanel>
          ) : (
          <form onSubmit={handleSignIn} className="relative">
            <AuthField
              id="auth-email"
              label="Email"
              icon={Mail}
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              value={email}
              onChange={changeField(setEmail)}
              required
            />

            <AuthField
              id="auth-password"
              label="Password"
              icon={LockKeyhole}
              inputRef={passwordRef}
              className=""
              type="password"
              autoComplete="current-password"
              aria-describedby={formError ? 'auth-password-rule auth-error' : 'auth-password-rule'}
              value={password}
              onChange={changeField(setPassword)}
              minLength={PASSWORD_MIN_LENGTH}
              required
            />
            {/* The rule under the field rather than as its placeholder, which
                vanished at the first keystroke, and tied to it, so a screen
                reader hears it with the field. "Forgot password?" shares its
                line, so the form is no taller for it. A plain text button,
                so FOCUS_RING; it keeps the typed email for the reset form. */}
            {/* Each on one line; below about 330px the two no longer fit
                side by side, and the link wraps under the rule, still at
                the right edge (ml-auto). */}
            <div className="mt-2 mb-6 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
              <p id="auth-password-rule" className="whitespace-nowrap text-xs text-plush-300">At least {PASSWORD_MIN_LENGTH} characters</p>
              <button
                ref={forgotRef}
                type="button"
                onPointerEnter={prefetchForgotPassword}
                onFocus={prefetchForgotPassword}
                onClick={() => { setFormError(null); setMode('forgot'); }}
                // A line of small text, in a box padded (and the padding
                // cancelled by the negative margin) only enough for a snug
                // focus ring. The 44px a finger needs is a transparent
                // ::before instead: the password field is 8px above, so a
                // 44px box would reach under it. The hit area starts at the
                // field's edge and runs down into the gap above Sign In,
                // stopping 4px short of it.
                className={`relative ml-auto -mx-1 -my-1.5 px-1 py-1.5 whitespace-nowrap rounded-sm text-xs font-semibold text-brass-200 underline underline-offset-4 decoration-brass-300/50 hover:text-white before:absolute before:inset-x-0 before:-top-0.5 before:h-11 before:content-[''] ${FOCUS_RING}`}
              >
                Forgot password?
              </button>
            </div>

            {/* Side by side from 360px; stacked below that, where two
                buttons would leave "Signing in…" no room. Sign In is the one
                brass button: most visitors to this screen are returning. */}
            <div className="grid grid-cols-1 min-[360px]:grid-cols-2 gap-3">
              <button
                type="submit"
                disabled={!!loadingAction}
                className={`btn-brass ${AUTH_ACTION} ${busyLook(loadingAction, 'signin')}`}
              >
                {loadingAction === 'signin'
                  ? <LoaderCircle aria-hidden="true" className="h-[18px] w-[18px] motion-safe:animate-spin" strokeWidth={2.4} />
                  : <LogIn aria-hidden="true" className="h-[18px] w-[18px]" strokeWidth={2.4} />}
                {loadingAction === 'signin' ? 'Signing in…' : 'Sign In'}
              </button>
              <button
                ref={signUpRef}
                type="button"
                onClick={handleSignUp}
                disabled={!!loadingAction}
                className={`btn-glass ${AUTH_ACTION} ${busyLook(loadingAction, 'signup')}`}
              >
                {loadingAction === 'signup'
                  ? <LoaderCircle aria-hidden="true" className="h-[18px] w-[18px] text-brass-300 motion-safe:animate-spin" strokeWidth={2.4} />
                  : <UserPlus aria-hidden="true" className="h-[18px] w-[18px] text-brass-300" strokeWidth={2.4} />}
                {loadingAction === 'signup' ? 'Creating…' : 'Sign Up'}
              </button>
            </div>
            {/* Under the buttons, where the reset form says its own, so the
                buttons do not move under the player's finger when it comes. */}
            {formError && <AuthAlert id="auth-error">{formError}</AuthAlert>}
          </form>
          )}
          {/* Where progress is kept, worded to be true before sign-in can
              know which: the account keeps it once the server has cloud
              saves (src/lib/cloudSave.js), and Settings says which it is.
              With the sign-in form only — the reset form has its own copy. */}
          {mode !== 'forgot' && (
            <p className="relative mt-5 text-center text-xs leading-relaxed text-plush-300">
              Your progress saves on this device, and to your account too when the server supports it. Settings shows which.
            </p>
          )}
        </div>
      </main>
    </div>
  );
};

export default Auth;
