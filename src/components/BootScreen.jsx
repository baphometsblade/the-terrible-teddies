import { useEffect, useState } from 'react';
import { WifiOff, RotateCw } from 'lucide-react';
import { RARITY_METAL } from '@/lib/rarity';
import { FOCUS_OUTLINE } from '@/lib/focus';

// How long the plain bouncing bear is allowed to stand alone before it starts
// explaining itself, and before it offers a way out.
export const HINT_AFTER_MS = 6000;
export const RETRY_AFTER_MS = 20000;

// The pre-JS loader in index.html draws this same medallion and wordmark, at
// the same size and in the same place, and fades out over this screen once
// React has rendered. Its arc and glow have been moving since first paint,
// these only start now, so for that half-second the two arcs would turn at
// different angles: two bears, not one. Starting each animation from its
// twin's start time puts them in step (keyframes and durations match: a 1.6s
// linear spin, a 2s pulse). Cosmetic, and a no-op once the loader is gone.
//
// Through the twin's `ready`, not its startTime directly: a production build
// can commit before the loader's first frame, while its animations are still
// pending and have no start time yet. ready settles once they do (at once if
// they already have), and rejects if the loader is removed first.
const LOADER_TWIN = { spin: 'loader-spin', pulse: 'loader-pulse' };
const adoptLoaderPhase = (node) => {
  if (!node || typeof document.getAnimations !== 'function') return;
  try {
    const running = new Map(document.getAnimations().map((a) => [a.animationName, a]));
    for (const own of node.getAnimations({ subtree: true })) {
      const twin = running.get(LOADER_TWIN[own.animationName]);
      if (!twin) continue;
      twin.ready
        .then(() => {
          if (own.playState !== 'idle' && twin.startTime !== null) own.startTime = twin.startTime;
        })
        .catch(() => {});
    }
  } catch {
    // An engine without the Web Animations API just starts the arc afresh.
  }
};

// A phone on its side (short and wide): there is no room for Reload under
// the hint, so it sits inside the hint's panel at its right end. The panel
// keeps that end clear from the moment it appears, so its text never re-wraps
// when the button arrives.
const BESIDE_PANEL =
  '[@media(max-height:500px)_and_(min-width:480px)]:col-start-1 [@media(max-height:500px)_and_(min-width:480px)]:row-start-1 ' +
  '[@media(max-height:500px)_and_(min-width:480px)]:pr-[9.5rem]';
const BESIDE_BUTTON =
  '[@media(max-height:500px)_and_(min-width:480px)]:col-start-1 [@media(max-height:500px)_and_(min-width:480px)]:row-start-1 ' +
  '[@media(max-height:500px)_and_(min-width:480px)]:justify-self-end [@media(max-height:500px)_and_(min-width:480px)]:self-center ' +
  '[@media(max-height:500px)_and_(min-width:480px)]:mr-3 [@media(max-height:500px)_and_(min-width:480px)]:w-32 [@media(max-height:500px)_and_(min-width:480px)]:px-4';

// The gate every player passes through while supabase-js resolves the stored
// session. Normally that is a few milliseconds off localStorage — but a
// returning player's access token has expired (they last an hour), so resolving
// it means a network refresh, and when that refresh cannot complete supabase-js
// retries with a back-off before giving up.
//
// Measured with the backend unreachable and an expired stored token: 8 requests
// over roughly 50 seconds, the whole time showing nothing but a bouncing bear,
// and then the login screen — so the player waits without explanation and is
// finally told, in effect, that they are logged out. (It does recover on its
// own if the network returns mid-retry, which is why this waits rather than
// bailing out early.)
//
// Nothing here shortens the wait; supabase-js owns that. What it changes is
// that the wait stops being silent.
//
// Kept light on purpose — it is imported statically, on the boot path. Every
// moving part is CSS (a transform spin and an opacity pulse, both on the
// compositor), not the Framer Motion repeat: Infinity the bear used to bounce
// on, which ran on the main thread — the thread the session restore needs.
// motion-safe: covers the OS preference and index.css stops both under the
// in-game Animations switch; the word says "Loading" either way.
//
// Geometry is shared with index.html's loader, which mirrors every size here
// in its own CSS: change one, change the other. Below 500px of height (a phone
// held sideways) the medallion, gaps and reserved band all step down, so the
// 20s Reload is on screen without scrolling. The height is dvh where it is
// supported, because the loader is position: fixed and so measures the
// visible viewport, not the one with the toolbars hidden.
const BootScreen = () => {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const started = Date.now();
    const id = setInterval(() => setElapsed(Date.now() - started), 1000);
    return () => clearInterval(id);
  }, []);

  const slow = elapsed >= HINT_AFTER_MS;
  const stuck = elapsed >= RETRY_AFTER_MS;

  return (
    <div className="relative min-h-screen supports-[height:100dvh]:min-h-dvh bar-backdrop flex items-center justify-center px-4 py-10 [@media(max-height:500px)]:py-3 overflow-x-clip">
      <div className="fixed inset-0 grain pointer-events-none" aria-hidden="true" />

      <main className="relative w-full max-w-sm [@media(max-height:500px)_and_(min-width:480px)]:max-w-xl flex flex-col items-center text-center">
        {/* The brand medallion: the bear in a brass ring, with a slow brass
            arc turning around it and lamplight breathing behind. */}
        <div
          ref={adoptLoaderPhase}
          className="relative grid h-32 w-32 [@media(max-height:500px)]:h-24 [@media(max-height:500px)]:w-24 place-items-center"
          aria-hidden="true"
        >
          <div className="absolute -inset-10 rounded-full bg-[radial-gradient(closest-side,rgba(251,191,36,0.2),transparent)] motion-safe:animate-pulse" />
          <div className="absolute inset-0 rounded-full border-2 border-white/[0.07] border-t-brass-300 border-r-brass-300/40 motion-safe:animate-spin motion-safe:[animation-duration:1.6s]" />
          <div
            className="relative h-24 w-24 [@media(max-height:500px)]:h-[4.5rem] [@media(max-height:500px)]:w-[4.5rem] rounded-full p-[3px] shadow-[0_14px_30px_-12px_rgba(0,0,0,0.9)]"
            style={{ background: RARITY_METAL.legendary }}
          >
            <div className="grid h-full w-full place-items-center rounded-full bg-night-900 text-5xl [@media(max-height:500px)]:text-[2.25rem]">🧸</div>
          </div>
        </div>

        {/* One text run, so it reads (and is found) as "Loading Terrible
            Teddies..."; the two halves are only styled apart. Sized so the
            gradient line never wraps at 320px — a gradient clipped to text
            stretches over both lines when it does. Arbitrary sizes, so
            leading-none holds at every step (text-4xl would bring its own
            2.5rem line). The largest step needs height as well as width. */}
        <h1 className="mt-7 [@media(max-height:500px)]:mt-4">
          <span className="block label-caps text-plush-300">Loading</span>{' '}
          <span className="mt-2 block font-display font-extrabold text-[1.875rem] min-[375px]:text-[2.25rem] [@media(min-width:640px)_and_(min-height:501px)]:text-[3rem] leading-none tracking-tight whitespace-nowrap text-brass-gradient">
            Terrible Teddies...
          </span>
        </h1>

        {/* Announced rather than just drawn: a player who cannot see the screen
            gets the same "it's still trying" information as one who can.
            A fixed height, not a minimum: the hint wraps to two or three
            lines depending on the width and the player's text size, and a
            minimum that the content outgrew pushed the column taller, so the
            medallion above hopped when Reload arrived. Fixed, it never moves;
            anything taller than the band runs on below it, still in the
            page (the root clips sideways only). */}
        <div
          aria-live="polite"
          className="mt-8 h-[9rem] w-full grid content-start justify-items-center gap-4 [@media(max-height:500px)]:mt-5 [@media(max-height:500px)_and_(min-width:480px)]:h-[4.5rem]"
        >
          {slow && (
            <p className={`panel-glass w-full rounded-xl px-4 py-3 flex items-start gap-3 text-left text-sm leading-snug text-plush-200 motion-safe:animate-in motion-safe:fade-in-0 motion-safe:duration-500 [[data-motion=off]_&]:animate-none ${BESIDE_PANEL}`}>
              <WifiOff aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-brass-300" strokeWidth={2.2} />
              <span>
                Still trying to reach the server. Check your connection — we&apos;ll keep
                retrying.
              </span>
            </p>
          )}
          {stuck && (
            <button
              type="button"
              onClick={() => window.location.reload()}
              className={`btn-brass inline-flex h-11 items-center justify-center gap-2 rounded-xl px-6 font-display text-base font-bold ${FOCUS_OUTLINE} ${BESIDE_BUTTON}`}
            >
              <RotateCw aria-hidden="true" className="h-[18px] w-[18px]" strokeWidth={2.4} />
              Reload
            </button>
          )}
        </div>
      </main>
    </div>
  );
};

export default BootScreen;
