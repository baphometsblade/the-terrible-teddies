import { useEffect } from 'react';
import { SCREEN_PAD } from '@/lib/safeArea';
import { focusWhenReady } from '@/lib/screenFocus';

// What a player under 18 is told, drawn by the static gate (DoorGate.jsx)
// rather than the door's lazy chunk: a device that was turned away fetches
// nothing to be told so, and a chunk that fails to arrive cannot strand it on
// the crash screen. Plain: no sign, no bouncer, no joke, no retry and no way
// back. The answer is the device's (src/lib/door.js keeps it), so a reload,
// another tab or a deep link all land here.
export const DECLINED_COPY = {
  title: 'Sorry · Terrible Teddies',
  text: 'Sorry, this room is 18+. Terrible Teddies is for players 18 and over. Thanks for being honest.',
};

// The full screen both the door and this one stand on: the room's backdrop
// and grain, padded clear of an installed phone's status bar and home
// indicator like the other full screens (SCREEN_PAD). dvh where it is
// supported, because a phone's browser toolbars take their share of 100vh.
export const DOOR_ROOM =
  `relative min-h-screen supports-[height:100dvh]:min-h-dvh bar-backdrop flex items-center justify-center overflow-x-clip ${SCREEN_PAD}`;

// The loader painted before the app's JS (index.html) fades out over whatever
// React draws first. BootScreen, which the door's chunk waits behind, matches
// it; the door and the turning away do not, so the loader's medallion and
// wordmark go at once, as App does past BootScreen. A no-op once it is gone.
export const useHandedOffLoader = () => {
  useEffect(() => {
    document.getElementById('initial-loader')?.classList.add('to-app');
  }, []);
};

const DoorDeclined = () => {
  useEffect(() => { document.title = DECLINED_COPY.title; }, []);
  useHandedOffLoader();
  // The status takes the focus (it is a landing point, not a control): the
  // form the player was in has gone, and a screen reader starts here.
  useEffect(() => focusWhenReady('[data-screen-root="door"] [role="status"]'), []);
  return (
    <div className={DOOR_ROOM}>
      <div className="fixed inset-0 grain pointer-events-none" aria-hidden="true" />
      <main data-screen-root="door" className="relative z-10 w-full max-w-md">
        {/* text-pretty keeps the last line from being the one word "honest." */}
        <p
          role="status"
          className="panel-glass rounded-2xl px-6 py-8 text-center font-display text-xl font-bold leading-snug text-pretty text-plush-100 focus:outline-none"
        >
          {DECLINED_COPY.text}
        </p>
      </main>
    </div>
  );
};

export default DoorDeclined;
