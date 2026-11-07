import { useEffect } from 'react';
import { FOCUS_OUTLINE } from '@/lib/focus';
import { LANDING } from '@/lib/publicCopy';
import { SCREEN_PAD } from '@/lib/safeArea';
import { focusWhenReady } from '@/lib/screenFocus';

const LINK = `inline-flex min-h-11 items-center underline underline-offset-4 decoration-brass-300/70 hover:decoration-brass-300 ${FOCUS_OUTLINE}`;

// The page a device sees before it has answered the door, and the page a
// crawler sees. No card art: those pictures are the adult set.
const PublicLanding = ({ onEnter }) => {
  useEffect(() => {
    document.title = 'Terrible Teddies — 18+ Card Battler';
    document.documentElement.dataset.content = 'sfw';
    document.getElementById('initial-loader')?.classList.add('to-app');
    return focusWhenReady('[data-screen-root="landing"] h1');
  }, []);

  return (
    <div className={`relative min-h-screen supports-[height:100dvh]:min-h-dvh bar-backdrop text-plush-100 ${SCREEN_PAD}`}>
      <div className="fixed inset-0 grain pointer-events-none" aria-hidden="true" />
      <main data-screen-root="landing" className="relative z-10 mx-auto flex w-full max-w-xl flex-col py-8">
        <p className="label-caps text-brass-300">{LANDING.eyebrow}</p>
        <h1 tabIndex={-1} className="mt-3 font-display text-4xl font-extrabold leading-tight text-white focus:outline-none sm:text-5xl">
          {LANDING.title}
        </h1>
        <p className="mt-4 text-lg font-semibold leading-snug text-plush-100">{LANDING.lede}</p>
        <div className="panel-glass mt-6 space-y-4 p-5 text-sm leading-relaxed text-plush-100">
          <p>{LANDING.body}</p>
          <p>{LANDING.detail}</p>
        </div>
        <button
          type="button"
          onClick={onEnter}
          className={`btn-brass mt-6 inline-flex h-12 w-full items-center justify-center rounded-xl px-6 font-display text-base font-bold ${FOCUS_OUTLINE}`}
        >
          {LANDING.enter}
        </button>
        <nav className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-sm" aria-label="Policies">
          <a className={LINK} href="/terms">Terms of use</a>
          <a className={LINK} href="/privacy">Privacy</a>
        </nav>
      </main>
    </div>
  );
};

export default PublicLanding;
