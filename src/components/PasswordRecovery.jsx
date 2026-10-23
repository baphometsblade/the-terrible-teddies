import { useEffect, useRef, useState } from 'react';
import { KeyRound, LockKeyhole, LoaderCircle, Check, CircleAlert, MailX, WifiOff } from 'lucide-react';
import { supabase } from '../utils/supabaseClient';
import { Medallion } from '@/components/ui/medallion';
import { RARITY_METAL } from '@/lib/rarity';
import { SCREEN_PAD } from '@/lib/safeArea';
import { AuthField, AUTH_ACTION, AUTH_TEXT_BUTTON as TEXT_BUTTON } from './AuthField';
import {
  newPasswordProblem, NEW_PASSWORD_PROBLEM_TEXT, passwordChangeError, PASSWORD_MIN_LENGTH,
} from '@/lib/passwordRecovery';

const TITLE = 'Reset Password · Terrible Teddies';

// What each stage shows at its head: the medallion's icon and metal, and the
// title. Brass for the work at hand and its success, pewter for a link that
// could not be used.
const HEAD = {
  checking: { icon: KeyRound, metal: RARITY_METAL.epic, title: 'Checking Your Link' },
  'set-password': { icon: KeyRound, metal: RARITY_METAL.legendary, title: 'Set a New Password' },
  done: { icon: Check, metal: RARITY_METAL.legendary, title: 'Password Changed' },
  expired: { icon: MailX, metal: RARITY_METAL.common, title: 'This Link Has Expired' },
  invalid: { icon: MailX, metal: RARITY_METAL.common, title: 'This Link Can’t Be Used' },
  offline: { icon: WifiOff, metal: RARITY_METAL.common, title: 'Couldn’t Check Your Link' },
};

/**
 * The screen a password-reset email lands on: choose a new password (the
 * link has signed the player in to do it), or, for a link Supabase refused,
 * say so and offer a new one. It stands in for the whole game while it is up
 * (integrations/supabase/auth.jsx), on the sign-in screen's materials.
 */
const PasswordRecovery = ({ recovery, signedIn, onPasswordSet, onLinkExpired, onDone }) => {
  const stage = recovery.stage === 'link-error' ? recovery.reason : recovery.stage;
  const head = HEAD[stage] ?? HEAD.expired;

  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  // A problem the form found itself ('too-short' | 'mismatch'), or the
  // server's refusal ({ kind, message }).
  const [problem, setProblem] = useState(null);
  const [serverError, setServerError] = useState(null);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);

  const passwordRef = useRef(null);
  const confirmationRef = useRef(null);
  const primaryRef = useRef(null);

  // The tab says where the player is, as each of the game's screens does.
  useEffect(() => {
    const before = document.title;
    document.title = TITLE;
    // The pre-JS loader's medallion and wordmark go at once rather than
    // ghosting over this panel for its fade (App does the same for its own
    // screens; App is not mounted while this is up).
    document.getElementById('initial-loader')?.classList.add('to-app');
    return () => { document.title = before; };
  }, []);

  // Focus follows the stage: into the first field to type a password, onto
  // the way on once it is changed or the link has failed.
  useEffect(() => {
    if (stage === 'set-password') passwordRef.current?.focus();
    else if (stage !== 'checking') primaryRef.current?.focus();
  }, [stage]);

  const submit = async (e) => {
    e.preventDefault();
    if (savingRef.current) return;
    const found = newPasswordProblem(password, confirmation);
    setProblem(found);
    setServerError(null);
    if (found) {
      (found === 'mismatch' ? confirmationRef : passwordRef).current?.focus();
      return;
    }
    savingRef.current = true;
    setSaving(true);
    let error = null;
    try {
      ({ error } = await supabase.auth.updateUser({ password }));
    } catch (err) {
      error = err;
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
    if (!error) {
      onPasswordSet();
      return;
    }
    const failure = passwordChangeError(error);
    if (failure.kind === 'expired') {
      onLinkExpired();
      return;
    }
    setServerError(failure);
    // The field the refusal is about, so the player can type over it.
    if (failure.kind === 'same' || failure.kind === 'weak') passwordRef.current?.select();
  };

  const problemText = problem ? NEW_PASSWORD_PROBLEM_TEXT[problem] : null;

  return (
    <div className={`relative min-h-screen bar-backdrop flex flex-col items-center justify-center overflow-x-hidden ${SCREEN_PAD}`}>
      <div className="fixed inset-0 grain pointer-events-none" aria-hidden="true" />
      <main className="relative w-full max-w-md py-6 sm:py-10">
        <div className="relative dialog-panel rounded-2xl px-5 py-6 sm:px-8 sm:py-8 overflow-hidden">
          {/* Lamplight over the counter, as on the sign-in screen. */}
          <div aria-hidden="true" className="absolute inset-x-0 top-0 h-32 pointer-events-none bg-[radial-gradient(ellipse_60%_100%_at_50%_0%,rgba(251,191,36,0.1),transparent_70%)]" />

          <header className="relative flex flex-col items-center text-center mb-6">
            <Medallion size="lg" icon={head.icon} metal={head.metal} className="mb-4" />
            {/* Brass only for the success: a gradient clipped to text that
                wraps (the longer titles do at 320) stretches over both lines. */}
            <h1 className={`font-display text-2xl min-[375px]:text-3xl font-extrabold leading-tight ${stage === 'done' ? 'text-brass-gradient' : 'text-white'}`}>
              {head.title}
            </h1>
          </header>

          {stage === 'checking' && (
            <p role="status" className="relative flex items-center justify-center gap-2 text-plush-200">
              <LoaderCircle aria-hidden="true" className="h-[18px] w-[18px] text-brass-300 motion-safe:animate-spin [[data-motion=off]_&]:animate-none" strokeWidth={2.4} />
              One moment while we check your reset link.
            </p>
          )}

          {stage === 'set-password' && (
            <form onSubmit={submit} noValidate className="relative">
              <p className="mb-5 text-center text-plush-200">
                Your reset link has signed you in. Choose the password you&apos;ll sign in with from now on.
              </p>
              <AuthField
                id="recovery-password"
                label="New password"
                icon={LockKeyhole}
                inputRef={passwordRef}
                className="mb-2"
                type="password"
                autoComplete="new-password"
                aria-describedby="recovery-password-rule"
                aria-invalid={problem === 'too-short' || serverError?.kind === 'same' || serverError?.kind === 'weak' || undefined}
                value={password}
                onChange={(e) => { setPassword(e.target.value); setProblem(null); setServerError(null); }}
                minLength={PASSWORD_MIN_LENGTH}
                required
              />
              {/* The sign-up form's rule, said the same way. */}
              <p id="recovery-password-rule" className="mb-5 text-xs text-plush-300">At least {PASSWORD_MIN_LENGTH} characters</p>

              <AuthField
                id="recovery-confirmation"
                label="Confirm new password"
                icon={LockKeyhole}
                inputRef={confirmationRef}
                className="mb-2"
                type="password"
                autoComplete="new-password"
                aria-describedby={problem || serverError ? 'recovery-problem' : undefined}
                aria-invalid={problem === 'mismatch' || undefined}
                value={confirmation}
                onChange={(e) => { setConfirmation(e.target.value); setProblem(null); setServerError(null); }}
                required
              />

              {/* Reserved, so a message does not push the button down
                  under the player's finger. */}
              <p id="recovery-problem" role="alert" className="min-h-[2.5rem] mb-3 flex items-start gap-1.5 text-sm text-red-200">
                {(problemText || serverError) && (
                  <>
                    <CircleAlert aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-red-300" strokeWidth={2.4} />
                    <span>{problemText ?? serverError.message}</span>
                  </>
                )}
              </p>

              {/* aria-disabled rather than disabled while saving: disabling
                  the focused button would drop keyboard focus. */}
              <button
                type="submit"
                aria-disabled={saving || undefined}
                className={`btn-brass ${AUTH_ACTION} aria-disabled:cursor-wait`}
              >
                {saving
                  ? <LoaderCircle aria-hidden="true" className="h-[18px] w-[18px] motion-safe:animate-spin [[data-motion=off]_&]:animate-none" strokeWidth={2.4} />
                  : <KeyRound aria-hidden="true" className="h-[18px] w-[18px]" strokeWidth={2.4} />}
                {saving ? 'Saving…' : 'Save new password'}
              </button>
              <div className="mt-4 text-center">
                <button type="button" onClick={() => onDone()} className={TEXT_BUTTON}>
                  Not now: continue to the game
                </button>
              </div>
            </form>
          )}

          {stage === 'done' && (
            <div className="relative text-center">
              <p role="status" className="mb-6 text-plush-200">
                Your password has been changed, and you&apos;re signed in. Use the new one next time you sign in.
              </p>
              <button ref={primaryRef} type="button" onClick={() => onDone()} className={`btn-brass ${AUTH_ACTION}`}>
                Continue to the game
              </button>
            </div>
          )}

          {(stage === 'expired' || stage === 'invalid') && (
            <div className="relative text-center">
              {/* An error in the link does not say which kind of email it
                  came from, so this holds for any of them. */}
              <p className="mb-6 text-plush-200">
                {stage === 'expired'
                  ? 'Email links work once, for a limited time, and this one has expired or has already been used.'
                  : 'This link isn’t valid any more.'}
                {' '}
                {signedIn
                  ? 'You’re still signed in on this device.'
                  : 'To reset your password, ask for a new link.'}
              </p>
              {signedIn ? (
                <button ref={primaryRef} type="button" onClick={() => onDone()} className={`btn-brass ${AUTH_ACTION}`}>
                  Continue to the game
                </button>
              ) : (
                <>
                  <button ref={primaryRef} type="button" onClick={() => onDone('forgot')} className={`btn-brass ${AUTH_ACTION}`}>
                    Send a new link
                  </button>
                  <div className="mt-4">
                    <button type="button" onClick={() => onDone()} className={TEXT_BUTTON}>
                      Back to sign in
                    </button>
                  </div>
                </>
              )}
            </div>
          )}

          {stage === 'offline' && (
            <div className="relative text-center">
              <p className="mb-6 text-plush-200">
                The server couldn&apos;t be reached, so your reset link hasn&apos;t been used yet. Check your connection, then try it again.
              </p>
              {/* The link is still in the address (supabase-js clears it only
                  once it has been used), so a reload tries it again. */}
              <button ref={primaryRef} type="button" onClick={() => window.location.reload()} className={`btn-brass ${AUTH_ACTION}`}>
                Try the link again
              </button>
              <div className="mt-4">
                <button type="button" onClick={() => onDone()} className={TEXT_BUTTON}>
                  {signedIn ? 'Continue to the game' : 'Back to sign in'}
                </button>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default PasswordRecovery;
