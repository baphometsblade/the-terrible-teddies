import { useEffect, useRef, useState } from 'react';
import { KeyRound, LockKeyhole, LoaderCircle, Check, CircleAlert, MailX, WifiOff } from 'lucide-react';
import { supabase } from '../utils/supabaseClient';
import { Medallion } from '@/components/ui/medallion';
import { RARITY_METAL } from '@/lib/rarity';
import { SCREEN_PAD } from '@/lib/safeArea';
import { AuthField, AUTH_ACTION, AUTH_TEXT_BUTTON as TEXT_BUTTON } from './AuthField';
import { HINT_AFTER_MS } from './BootScreen';
import {
  newPasswordProblem, NEW_PASSWORD_PROBLEM_TEXT, passwordChangeError, PASSWORD_MIN_LENGTH, linkErrorWayOn,
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
 * In place of a link-error screen's way on while the stored session is
 * restored: usually a moment, but for a returning player it is a network
 * refresh, which supabase-js retries for up to about a minute when the server
 * cannot be reached. Announced, so the wait is not silent to a screen reader.
 */
const RestoringNote = ({ slow }) => (
  <div role="status" className="flex flex-col items-center gap-2 text-sm text-plush-200">
    <p className="flex items-center justify-center gap-2">
      <LoaderCircle aria-hidden="true" className="h-[18px] w-[18px] shrink-0 text-brass-300 motion-safe:animate-spin [[data-motion=off]_&]:animate-none" strokeWidth={2.4} />
      Checking whether you’re still signed in on this device…
    </p>
    {slow && (
      <p className="text-plush-300">
        Still trying to reach the server. Check your connection — we’ll keep retrying.
      </p>
    )}
  </div>
);

/**
 * The screen a password-reset email lands on: choose a new password (the
 * link has signed the player in to do it), or, for a link Supabase refused,
 * say so and offer a new one. It stands in for the whole game while it is up
 * (integrations/supabase/auth.jsx), on the sign-in screen's materials.
 *
 * `restoring` is true while supabase-js is still restoring the stored session,
 * so `signedIn` is not yet known: a link that could not be used offers its
 * way on (the game, or a new link) only once it is.
 */
const PasswordRecovery = ({ recovery, signedIn, restoring, onPasswordSet, onLinkExpired, onDone }) => {
  const stage = recovery.stage === 'link-error' ? recovery.reason : recovery.stage;
  const head = HEAD[stage] ?? HEAD.expired;
  const wayOn = linkErrorWayOn({ restoring, signedIn });
  // A restore that is slow to finish says why, as the boot screen does.
  const [slowRestore, setSlowRestore] = useState(false);
  useEffect(() => {
    if (wayOn !== 'wait') return undefined;
    const t = setTimeout(() => setSlowRestore(true), HINT_AFTER_MS);
    return () => clearTimeout(t);
  }, [wayOn]);

  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  // A problem the form found itself ('too-short' | 'mismatch'), or the
  // server's refusal ({ kind, message }).
  const [problem, setProblem] = useState(null);
  const [serverError, setServerError] = useState(null);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);

  const panelRef = useRef(null);
  const passwordRef = useRef(null);
  const confirmationRef = useRef(null);
  const primaryRef = useRef(null);
  const shownStage = useRef(null);

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
  // the way on once it is changed or the link has failed. The way on can
  // also arrive, or change, after the stage (the session restoring, or
  // signing out in another tab), unmounting what had focus; it is then
  // placed again, unless the player has moved it within the panel.
  useEffect(() => {
    const entered = shownStage.current !== stage;
    shownStage.current = stage;
    if (stage === 'set-password') {
      if (entered) passwordRef.current?.focus();
      return;
    }
    if (stage === 'checking') return;
    if (entered || !panelRef.current?.contains(document.activeElement)) primaryRef.current?.focus();
  }, [stage, wayOn]);

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
    }
    const failure = error ? passwordChangeError(error) : null;
    if (failure?.kind === 'expired') {
      // Supabase has said this session is gone, but supabase-js keeps it, so
      // the panel would go on to say "you're still signed in" and offer the
      // game rather than a new link. Dropped here first (this device only:
      // there is nothing left on the server to sign out of). signOut removes
      // it even when it cannot reach the server.
      try {
        await supabase.auth.signOut({ scope: 'local' });
      } catch {
        // Nothing more to do: the panel still says the link has expired.
      }
    }
    savingRef.current = false;
    setSaving(false);
    if (!error) {
      onPasswordSet();
      return;
    }
    if (failure.kind === 'expired') {
      onLinkExpired();
      return;
    }
    setServerError(failure);
    // The field the refusal is about, so the player can type over it.
    if (failure.kind === 'same' || failure.kind === 'weak') {
      passwordRef.current?.focus();
      passwordRef.current?.select();
    }
  };

  const problemText = problem ? NEW_PASSWORD_PROBLEM_TEXT[problem] : null;

  return (
    <div className={`relative min-h-screen bar-backdrop flex flex-col items-center justify-center overflow-x-hidden ${SCREEN_PAD}`}>
      <div className="fixed inset-0 grain pointer-events-none" aria-hidden="true" />
      <main className="relative w-full max-w-md py-6 sm:py-10">
        <div ref={panelRef} className="relative dialog-panel rounded-2xl px-5 py-6 sm:px-8 sm:py-8 overflow-hidden">
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
                {wayOn === 'game' && ' You’re still signed in on this device.'}
                {wayOn === 'sign-in' && ' To reset your password, ask for a new link.'}
              </p>
              {wayOn === 'wait' && <RestoringNote slow={slowRestore} />}
              {wayOn === 'game' && (
                <button ref={primaryRef} type="button" onClick={() => onDone()} className={`btn-brass ${AUTH_ACTION}`}>
                  Continue to the game
                </button>
              )}
              {wayOn === 'sign-in' && (
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
              {/* Where this goes depends on the session, so it waits for it. */}
              {wayOn !== 'wait' && (
                <div className="mt-4">
                  <button type="button" onClick={() => onDone()} className={TEXT_BUTTON}>
                    {wayOn === 'game' ? 'Continue to the game' : 'Back to sign in'}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default PasswordRecovery;
