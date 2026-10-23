import { useState } from 'react';
import { Mail, LockKeyhole, LogIn, UserPlus, LoaderCircle } from 'lucide-react';
import { supabase } from '../utils/supabaseClient';
import { useToast } from "@/components/ui/use-toast";
import { RARITY_METAL } from '@/lib/rarity';
import { FOCUS_OUTLINE } from '@/lib/focus';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { ALL_CARDS } from '../stores/gameStore';
import CardFan from './CardFan';

// The key art beside the form from lg up: three of the set's best-dressed,
// fanned as the main menu fans a player's own (the legendary in the centre).
// Resolved by name, so ids and the shipped art stay canonical.
const KEY_ART = ['Mama Mauls', 'The Godfluffer', 'Duke of Dumpsterfire']
  .map((name) => ALL_CARDS.find((c) => c.name === name))
  .filter(Boolean);

// A field recessed into the panel. Plain <input>s rather than the shadcn Input,
// whose ring-offset-background and bg-background are a light theme's. The
// autofill rules stop Chrome painting a saved email pale blue on a dark form:
// its autofill background-color cannot be overridden, only covered by an inset
// shadow — and an inset shadow covers only the padding box, so bg-clip-padding
// keeps that fill from painting under the translucent border too, where it
// showed as a pale ring around every autofilled field.
//
// Focus is FOCUS_OUTLINE on everything here. On the two buttons a ring (a
// box-shadow) would replace the materials' own rim light and depth; the fields
// follow suit, so the form keeps one focus language.
const FIELD =
  'block w-full h-12 rounded-xl pl-11 pr-4 text-base text-plush-100 placeholder:text-plush-300 caret-brass-300 ' +
  'bg-night-950/70 bg-clip-padding border border-white/10 hover:border-white/20 focus-visible:border-brass-300/60 transition-colors ' +
  'autofill:shadow-[inset_0_0_0_1000px_#1b1328] autofill:[-webkit-text-fill-color:#ece6f2] ' +
  FOCUS_OUTLINE;

const ACTION =
  `inline-flex w-full items-center justify-center gap-2 h-12 rounded-xl px-4 font-display text-base font-bold whitespace-nowrap ${FOCUS_OUTLINE}`;

// While a request runs both buttons are disabled, but only the idle one dims:
// the one doing the work stays lit, with its spinner, so it reads as busy
// rather than broken.
const busyLook = (loadingAction, which) =>
  loadingAction === which ? 'disabled:cursor-wait' : 'disabled:opacity-60 disabled:cursor-not-allowed';

const Auth = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loadingAction, setLoadingAction] = useState(null); // 'signin' | 'signup' | null
  const { toast } = useToast();
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
    try {
      const { error } = await supabase.auth.signUp({ email, password });
      if (error) {
        toast({ title: "Error", description: error.message, variant: "destructive" });
      } else {
        toast({ title: "Account Created", description: "Check your email for the confirmation link!" });
      }
    } catch (err) {
      toast({ title: "Network error", description: "Couldn't reach the server. Please try again.", variant: "destructive" });
    } finally {
      setLoadingAction(null);
    }
  };

  const handleSignIn = async (e) => {
    e.preventDefault();
    if (!email || !password) return;
    setLoadingAction('signin');
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        toast({ title: "Sign In Failed", description: error.message, variant: "destructive" });
      }
    } catch (err) {
      toast({ title: "Network error", description: "Couldn't reach the server. Please try again.", variant: "destructive" });
    } finally {
      setLoadingAction(null);
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

          <form onSubmit={handleSignIn} className="relative">
            <label htmlFor="auth-email" className="block label-caps text-plush-300 mb-2">Email</label>
            <div className="relative mb-5">
              <Mail aria-hidden="true" className="pointer-events-none absolute left-4 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-plush-300" strokeWidth={2} />
              <input
                id="auth-email"
                type="email"
                autoComplete="email"
                aria-label="Email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={FIELD}
                required
              />
            </div>

            <label htmlFor="auth-password" className="block label-caps text-plush-300 mb-2">Password</label>
            <div className="relative">
              <LockKeyhole aria-hidden="true" className="pointer-events-none absolute left-4 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-plush-300" strokeWidth={2} />
              <input
                id="auth-password"
                type="password"
                autoComplete="current-password"
                aria-label="Password"
                aria-describedby="auth-password-rule"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={FIELD}
                minLength={6}
                required
              />
            </div>
            {/* The rule under the field rather than as its placeholder, which
                vanished at the first keystroke, and tied to it, so a screen
                reader hears it with the field. */}
            <p id="auth-password-rule" className="mt-2 mb-6 text-xs text-plush-300">At least 6 characters</p>

            {/* Side by side from 360px; stacked below that, where two
                buttons would leave "Signing in…" no room. Sign In is the one
                brass button: most visitors to this screen are returning. */}
            <div className="grid grid-cols-1 min-[360px]:grid-cols-2 gap-3">
              <button
                type="submit"
                disabled={!!loadingAction}
                className={`btn-brass ${ACTION} ${busyLook(loadingAction, 'signin')}`}
              >
                {loadingAction === 'signin'
                  ? <LoaderCircle aria-hidden="true" className="h-[18px] w-[18px] motion-safe:animate-spin" strokeWidth={2.4} />
                  : <LogIn aria-hidden="true" className="h-[18px] w-[18px]" strokeWidth={2.4} />}
                {loadingAction === 'signin' ? 'Signing in…' : 'Sign In'}
              </button>
              <button
                type="button"
                onClick={handleSignUp}
                disabled={!!loadingAction}
                className={`btn-glass ${ACTION} ${busyLook(loadingAction, 'signup')}`}
              >
                {loadingAction === 'signup'
                  ? <LoaderCircle aria-hidden="true" className="h-[18px] w-[18px] text-brass-300 motion-safe:animate-spin" strokeWidth={2.4} />
                  : <UserPlus aria-hidden="true" className="h-[18px] w-[18px] text-brass-300" strokeWidth={2.4} />}
                {loadingAction === 'signup' ? 'Creating…' : 'Sign Up'}
              </button>
            </div>
          </form>
          {/* Where progress is kept, worded to be true before sign-in can
              know which: the account keeps it once the server has cloud
              saves (src/lib/cloudSave.js), and Settings says which it is. */}
          <p className="relative mt-5 text-center text-xs leading-relaxed text-plush-300">
            Your progress saves on this device, and to your account too when the server supports it. Settings shows which.
          </p>
        </div>
      </main>
    </div>
  );
};

export default Auth;
