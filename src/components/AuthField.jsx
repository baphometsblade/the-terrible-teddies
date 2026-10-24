import { useEffect, useRef } from 'react';
import { CircleAlert } from 'lucide-react';
import { FOCUS_OUTLINE, FOCUS_RING } from '@/lib/focus';

// The account screens' shared form parts: the sign-in / sign-up / reset form
// (Auth.jsx) and the set-new-password panel (PasswordRecovery.jsx) draw the
// same fields and buttons, so the two cannot drift apart.

// A field recessed into the panel. Plain <input>s rather than the shadcn Input,
// whose ring-offset-background and bg-background are a light theme's. The
// autofill rules stop Chrome painting a saved email pale blue on a dark form:
// its autofill background-color cannot be overridden, only covered by an inset
// shadow — and an inset shadow covers only the padding box, so bg-clip-padding
// keeps that fill from painting under the translucent border too, where it
// showed as a pale ring around every autofilled field.
//
// Focus is FOCUS_OUTLINE on everything here. On the buttons a ring (a
// box-shadow) would replace the materials' own rim light and depth; the fields
// follow suit, so the form keeps one focus language. aria-invalid tints the
// border red, beside the message that says what is wrong.
export const AUTH_FIELD =
  'block w-full h-12 rounded-xl pl-11 pr-4 text-base text-plush-100 placeholder:text-plush-300 caret-brass-300 ' +
  'bg-night-950/70 bg-clip-padding border border-white/10 hover:border-white/20 focus-visible:border-brass-300/60 transition-colors ' +
  'aria-[invalid=true]:border-red-400/70 ' +
  'autofill:shadow-[inset_0_0_0_1000px_#1b1328] autofill:[-webkit-text-fill-color:#ece6f2] ' +
  FOCUS_OUTLINE;

export const AUTH_ACTION =
  `inline-flex w-full items-center justify-center gap-2 h-12 rounded-xl px-4 font-display text-base font-bold whitespace-nowrap ${FOCUS_OUTLINE}`;

// The secondary way out of a step ("Back to sign in", "Send again"): plain
// underlined text, so FOCUS_RING, in a box 44px tall (min-h-11), the size
// the game holds every control to. Each sits on a line of its own, so the
// box costs a little height rather than crowding a neighbour.
// aria-disabled (a countdown) takes the underline away.
export const AUTH_TEXT_BUTTON =
  'inline-flex min-h-11 items-center justify-center rounded-md px-2 text-sm text-plush-300 underline underline-offset-4 decoration-plush-400/60 hover:text-white ' +
  'aria-disabled:no-underline aria-disabled:cursor-not-allowed aria-disabled:hover:text-plush-300 ' +
  FOCUS_RING;

// While a request runs the buttons are disabled, but only the idle one dims:
// the one doing the work stays lit, with its spinner, so it reads as busy
// rather than broken.
export const busyLook = (loadingAction, which) =>
  loadingAction === which ? 'disabled:cursor-wait' : 'disabled:opacity-60 disabled:cursor-not-allowed';

/**
 * What a request on the account screens came back with, said where the
 * player is looking (under the form's buttons) and announced (role=alert).
 * The reset form's network failure, and sign-in and sign-up's answers, which
 * used to be toasts that were gone in five seconds.
 */
export const AuthAlert = ({ id, children }) => (
  <p id={id} role="alert" className="mt-4 flex items-start justify-center gap-1.5 text-sm text-red-200">
    <CircleAlert aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-red-300" strokeWidth={2.4} />
    <span>{children}</span>
  </p>
);

/**
 * "Check your email", in place of a form whose job is done: after asking for
 * a reset link, and after signing up while the server wants the address
 * confirmed. The heading takes the focus as it appears (tabIndex -1: never a
 * tab stop), so a screen reader starts here; `children` is the message,
 * `onBack` returns to signing in, and `footer` is anything under that (the
 * reset form's Send again).
 */
export const CheckEmailPanel = ({ children, onBack, footer = null }) => {
  const headingRef = useRef(null);
  useEffect(() => { headingRef.current?.focus(); }, []);
  return (
    <div className="relative">
      <h2 ref={headingRef} tabIndex={-1} className="font-display text-xl font-bold text-white focus:outline-none">
        Check your email
      </h2>
      <p className="mt-2 mb-6 text-sm leading-relaxed text-plush-200">{children}</p>
      <button type="button" onClick={onBack} className={`btn-brass ${AUTH_ACTION}`}>
        Back to sign in
      </button>
      {footer}
    </div>
  );
};

/**
 * A labelled field with its icon set into the left of the well. The label
 * sits above it, set in label-caps, and is the field's accessible name.
 */
export const AuthField = ({ id, label, icon: Icon, inputRef, className = 'mb-5', ...input }) => (
  <>
    <label htmlFor={id} className="block label-caps text-plush-300 mb-2">{label}</label>
    <div className={`relative ${className}`}>
      <Icon aria-hidden="true" className="pointer-events-none absolute left-4 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-plush-300" strokeWidth={2} />
      <input id={id} ref={inputRef} className={AUTH_FIELD} {...input} />
    </div>
  </>
);
