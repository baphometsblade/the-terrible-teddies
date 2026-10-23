import { useEffect, useRef, useState } from 'react';
import { Mail, Send, LoaderCircle, CircleAlert } from 'lucide-react';
import { supabase } from '../utils/supabaseClient';
import { AuthField, AUTH_ACTION, AUTH_TEXT_BUTTON as TEXT_BUTTON } from './AuthField';
import { resetRequestOutcome, RESEND_COOLDOWN_MS } from '@/lib/passwordRecovery';

/**
 * "Forgot password?" on the sign-in screen: asks Supabase to email a reset
 * link that comes back to this site (the recovery panel takes it from there).
 *
 * Whatever the server answers, the player is told the same thing ("if an
 * account exists for that email..."), so the form cannot be used to find out
 * whether an address has an account. Only a request that got no answer at
 * all says so. Two taps send one email: a request in flight ignores the
 * second, and the same address is not sent to again for a minute.
 */
const ForgotPassword = ({ email, onEmailChange, onBack }) => {
  const [stage, setStage] = useState('form'); // form | sent
  const [sending, setSending] = useState(false);
  const sendingRef = useRef(false);
  const [offline, setOffline] = useState(false);
  const [sentTo, setSentTo] = useState(null); // { email, at }
  const [now, setNow] = useState(() => Date.now());
  const emailRef = useRef(null);
  const headingRef = useRef(null);

  // Into the field to type an address; onto the news once it is sent.
  useEffect(() => {
    if (stage === 'form') emailRef.current?.focus();
    else headingRef.current?.focus();
  }, [stage]);

  const remaining = sentTo ? Math.max(0, RESEND_COOLDOWN_MS - (now - sentTo.at)) : 0;
  useEffect(() => {
    if (remaining <= 0) return undefined;
    const t = setTimeout(() => setNow(Date.now()), Math.min(1000, remaining));
    return () => clearTimeout(t);
  }, [remaining, now]);

  const send = async (target) => {
    if (sendingRef.current) return;
    // The same address again within the minute: it has just been sent.
    if (sentTo && sentTo.email === target && Date.now() - sentTo.at < RESEND_COOLDOWN_MS) {
      setStage('sent');
      return;
    }
    sendingRef.current = true;
    setSending(true);
    setOffline(false);
    let error = null;
    try {
      ({ error } = await supabase.auth.resetPasswordForEmail(target, { redirectTo: window.location.origin }));
    } catch {
      // A throw is a request that never got an answer.
      error = { name: 'AuthRetryableFetchError' };
    } finally {
      sendingRef.current = false;
      setSending(false);
    }
    if (resetRequestOutcome(error) === 'offline') {
      setOffline(true);
      return;
    }
    const at = Date.now();
    setSentTo({ email: target, at });
    setNow(at);
    setStage('sent');
  };

  const offlineLine = offline && (
    <p role="alert" className="mt-4 flex items-start justify-center gap-1.5 text-sm text-red-200">
      <CircleAlert aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-red-300" strokeWidth={2.4} />
      <span>Couldn&apos;t reach the server. Check your connection and try again.</span>
    </p>
  );

  if (stage === 'sent') {
    const seconds = Math.ceil(remaining / 1000);
    return (
      <div className="relative">
        {/* Focused when it appears (tabIndex -1: not a tab stop), so a
            screen reader starts here. */}
        <h2 ref={headingRef} tabIndex={-1} className="font-display text-xl font-bold text-white focus:outline-none">
          Check your email
        </h2>
        <p className="mt-2 mb-6 text-sm leading-relaxed text-plush-200">
          If an account exists for <strong className="font-semibold text-white [overflow-wrap:anywhere]">{sentTo.email}</strong>,
          we&apos;ve sent it a link to set a new password. If nothing arrives in a few minutes, check your spam folder.
        </p>
        <button type="button" onClick={onBack} className={`btn-brass ${AUTH_ACTION}`}>
          Back to sign in
        </button>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          {/* aria-disabled, not disabled, so it keeps focus while it counts. */}
          <button
            type="button"
            aria-disabled={remaining > 0 || sending || undefined}
            onClick={() => { if (remaining <= 0) send(sentTo.email); }}
            className={TEXT_BUTTON}
          >
            {sending ? 'Sending…' : remaining > 0 ? `Send again in ${seconds}s` : 'Send again'}
          </button>
          <button type="button" onClick={() => { setOffline(false); setStage('form'); }} className={TEXT_BUTTON}>
            Use a different email
          </button>
        </div>
        {offlineLine}
      </div>
    );
  }

  return (
    <form onSubmit={(e) => { e.preventDefault(); send(email.trim()); }} className="relative">
      <h2 className="font-display text-xl font-bold text-white">Reset your password</h2>
      <p className="mt-2 mb-5 text-sm leading-relaxed text-plush-200">
        Enter the email you signed up with, and we&apos;ll send you a link to set a new password.
      </p>
      <AuthField
        id="auth-reset-email"
        label="Email"
        icon={Mail}
        inputRef={emailRef}
        type="email"
        autoComplete="email"
        placeholder="you@example.com"
        value={email}
        onChange={(e) => onEmailChange(e.target.value)}
        required
      />
      {/* aria-disabled rather than disabled while sending: disabling the
          focused button would drop keyboard focus. */}
      <button
        type="submit"
        aria-disabled={sending || undefined}
        className={`btn-brass ${AUTH_ACTION} aria-disabled:cursor-wait`}
      >
        {sending
          ? <LoaderCircle aria-hidden="true" className="h-[18px] w-[18px] motion-safe:animate-spin [[data-motion=off]_&]:animate-none" strokeWidth={2.4} />
          : <Send aria-hidden="true" className="h-[18px] w-[18px]" strokeWidth={2.4} />}
        {sending ? 'Sending…' : 'Send reset link'}
      </button>
      <div className="mt-4 text-center">
        <button type="button" onClick={onBack} className={TEXT_BUTTON}>
          Back to sign in
        </button>
      </div>
      {offlineLine}
    </form>
  );
};

export default ForgotPassword;
