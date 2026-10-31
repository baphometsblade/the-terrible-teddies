import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { createDoor, DOOR_ART, DOOR_KEY } from '@/lib/door';
import { initializePostHog } from '@/utils/analytics';
// Static, as App imports it: BootScreen covers the door's chunk, and a chunk
// for the thing that covers a round-trip would be a round-trip.
import BootScreen from './BootScreen';
import DoorDeclined from './DoorDeclined';

// The door in front of the game (main.jsx mounts it between the motion
// setting and the Supabase provider). It gates everything: the game, the
// sign-in screen and the password-reset landing alike, so a device that has
// not been let in sees nothing but the door, and one that was turned away
// sees nothing but the reason.
//
//   'ask'       no answer on this device yet: the door is drawn
//   'opening'   a pass is in and the door is swinging; the game is not yet
//   'pass'      the game, exactly as it was before the door existed
//   'declined'  under 18: the plain screen, for good, on this device
//
// The scene is a lazy chunk, so a returning player's first paint carries
// only the few hundred bytes of src/lib/door.js and this file, and never
// downloads the door.
//
// It has no DialogErrorBoundary round it, on purpose. App's lazy screens do:
// a chunk that fails to arrive becomes a notice that can be dismissed and the
// game goes on. Here that dismissal would be a way in without answering, so a
// door that cannot load is left to the app-wide error screen, which has no
// way past it.
//
// Nothing of the game mounts until the pass is in: no Daily Rewards, no
// tutorial, no sign-in screen and no analytics (below). The game's modules
// still load and run, in the entry chunk as they always did (a returning
// player must not wait on a second request), so the store hydrates from
// localStorage and supabase-js still restores, and refreshes, a stored
// session at import; none of it reaches the player. The recovery landing
// needs nothing from the provider while the door is up: authLanding.js and
// supabase-js read the address when they load, and auth.jsx notes the reset
// at module load, so the link is still there to be acted on once the door
// has opened, even after a reload at the door (e2e/password-reset.spec.js).
// The query string is never touched, so ?action= is still in the address for
// App to find once the game is up.
const loadDoor = () => import('./TheDoor');
const TheDoor = lazy(loadDoor);

// One door for the page: it holds the answer a blocked localStorage cannot.
const door = createDoor();

// Starts the chunk and the art on their way together, instead of the art
// waiting for the scene to render before it is asked for. Only for a device
// that is going to see the door; a failure here says nothing, because the
// render's own import reports it.
const warmTheDoor = () => {
  loadDoor().catch(() => {});
  try {
    const art = new Image();
    art.fetchPriority = 'high';
    art.src = DOOR_ART;
  } catch {
    // An engine without Image just draws it when the door does.
  }
};

const DoorGate = ({ children }) => {
  // Analytics start once the door has let the player in, and not before: a
  // player turned away never loads the SDK or sends a thing (analytics.js
  // queues what is raised before it starts, in memory, and sends nothing
  // until initializePostHog runs). A returning player is a pass from the
  // first render, so theirs starts before the first commit, as it did before
  // the door existed: a crash while the game first renders is still reported
  // (a start in an effect would never run for it). A first-ever pass starts
  // in the effect below. Once: opening and then pass are both "in".
  const analyticsStarted = useRef(false);
  const [state, setState] = useState(() => {
    const answer = door.read();
    if (answer === 'pass' && !analyticsStarted.current) {
      analyticsStarted.current = true;
      initializePostHog();
    }
    return answer;
  });
  useEffect(() => {
    if ((state === 'opening' || state === 'pass') && !analyticsStarted.current) {
      analyticsStarted.current = true;
      initializePostHog();
    }
  }, [state]);

  useEffect(() => {
    if (state === 'ask') warmTheDoor();
  }, [state]);

  // Two tabs can both be showing the door. When one declines, the other must
  // not go on asking: it takes the decline too. (A pass in another tab does
  // not move this one; the player answers here, and a pass never overwrites
  // a decline either way, see createDoor.)
  useEffect(() => {
    if (state !== 'ask') return undefined;
    const onStorage = (e) => {
      if (e.key !== null && e.key !== DOOR_KEY) return;
      if (door.read() === 'declined') setState('declined');
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [state]);

  const onPass = useCallback(() => setState(door.pass() === 'pass' ? 'opening' : 'declined'), []);
  const onDecline = useCallback(() => setState(door.decline()), []);
  const onOpened = useCallback(() => setState('pass'), []);

  if (state === 'pass') return children;
  // Drawn here, not by the door's chunk: a turned-away device fetches nothing.
  if (state === 'declined') return <DoorDeclined />;
  return (
    <Suspense fallback={<BootScreen />}>
      <TheDoor state={state} onPass={onPass} onDecline={onDecline} onOpened={onOpened} />
    </Suspense>
  );
};

export default DoorGate;
