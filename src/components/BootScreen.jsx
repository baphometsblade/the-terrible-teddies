import { useEffect, useState } from 'react';
import { WifiOff, RotateCw } from 'lucide-react';
import { RARITY_METAL } from '@/lib/rarity';

// How long the plain bouncing bear is allowed to stand alone before it starts
// explaining itself, and before it offers a way out.
export const HINT_AFTER_MS = 6000;
export const RETRY_AFTER_MS = 20000;

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
    <div className="relative min-h-screen bar-backdrop flex items-center justify-center px-4 py-10 overflow-hidden">
      <div className="fixed inset-0 grain pointer-events-none" aria-hidden="true" />

      <main className="relative w-full max-w-sm flex flex-col items-center text-center">
        {/* The brand medallion: the bear in a brass ring, with a slow brass
            arc turning around it and lamplight breathing behind. */}
        <div className="relative grid h-32 w-32 place-items-center" aria-hidden="true">
          <div className="absolute -inset-10 rounded-full bg-[radial-gradient(closest-side,rgba(251,191,36,0.2),transparent)] motion-safe:animate-pulse" />
          <div className="absolute inset-0 rounded-full border-2 border-white/[0.07] border-t-brass-300 border-r-brass-300/40 motion-safe:animate-spin motion-safe:[animation-duration:1.6s]" />
          <div
            className="relative h-24 w-24 rounded-full p-[3px] shadow-[0_14px_30px_-12px_rgba(0,0,0,0.9)]"
            style={{ background: RARITY_METAL.legendary }}
          >
            <div className="grid h-full w-full place-items-center rounded-full bg-night-900 text-5xl">🧸</div>
          </div>
        </div>

        {/* One text run, so it reads (and is found) as "Loading Terrible
            Teddies..."; the two halves are only styled apart. Sized so the
            gradient line never wraps at 320px — a gradient clipped to text
            stretches over both lines when it does. */}
        <h1 className="mt-7">
          <span className="block label-caps text-plush-300">Loading</span>{' '}
          <span className="mt-2 block font-display font-extrabold text-[1.875rem] min-[375px]:text-4xl sm:text-5xl leading-none tracking-tight whitespace-nowrap text-brass-gradient">
            Terrible Teddies...
          </span>
        </h1>

        {/* Announced rather than just drawn: a player who cannot see the screen
            gets the same "it's still trying" information as one who can.
            Reserves its height, so the medallion above stays put when the
            hint and the button arrive instead of hopping up the screen. */}
        <div aria-live="polite" className="mt-8 w-full min-h-[8.5rem] flex flex-col items-center">
          {slow && (
            <p className="panel-glass w-full rounded-xl px-4 py-3 flex items-start gap-3 text-left text-sm leading-snug text-plush-200 motion-safe:animate-in motion-safe:fade-in-0 motion-safe:duration-500 [[data-motion=off]_&]:animate-none">
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
              className="btn-brass mt-4 inline-flex h-11 items-center justify-center gap-2 rounded-xl px-6 font-display text-base font-bold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brass-300"
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
