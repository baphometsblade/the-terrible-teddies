// System Back — Android's back gesture, an installed app's Back, the
// browser's button — and the game. Navigation here is React state (App's
// currentScreen and its dialog flags), not URLs, so the whole game was one
// history entry and every Back left it outright: from an open dialog, from
// the Collection, from the middle of a battle (booking the loss on the way).
//
// What is open registers a layer here, in the order it opened, and Back is
// handed to the top one instead: a dialog closes as Escape would close it,
// a screen returns to the menu, a live battle asks first. With nothing
// registered, Back is left alone and leaves the game as it always did.
//
// One guard entry for the lot, never one per layer. Each layer pushing its
// own entry and calling history.back() as it closed broke on stacked
// layers: the popstate from one layer's back() reached the next one's
// listener and closed that too, and a pushState issued while a back() was
// still on its way raced it (history traversal is asynchronous). So the
// guard is pushed when the first layer opens, and stepped off — with one
// back() of our own, whose popstate is recognised and ignored — when the
// last one closes. Nothing is ever pushed while that back() is pending, so
// opening and closing a dialog any number of times leaves the history as it
// found it.
//
// A layer opened with no user gesture behind it (Daily Rewards opening by
// itself) pushes the guard all the same, but Chrome skips entries a page
// added that way when the user goes Back, so there Back may still leave.

const GUARD = 'tt-back-guard';
// Which page load pushed a guard. A reload while one is up leaves it as the
// entry the new page starts on, and that one is not ours to answer for: Back
// from a guard this page pushed lands on it, and taken for our own it read
// as a Forward, so the dialog never closed.
const PAGE = Math.random().toString(36).slice(2);

const layers = [];
let guarded = false; // the current history entry is the guard we pushed
let pendingBacks = 0; // our own back() calls whose popstate has not arrived
let installed = false;

const onGuardEntry = () => window.history.state?.tt === GUARD && window.history.state.page === PAGE;

function pushGuard() {
  if (guarded || pendingBacks > 0 || layers.length === 0) return;
  window.history.pushState({ tt: GUARD, page: PAGE }, '');
  guarded = true;
}

function stepOff() {
  guarded = false;
  pendingBacks += 1;
  window.history.back();
}

function onPopState() {
  if (pendingBacks > 0) {
    // Our own step off the guard arriving. A layer that opened meanwhile
    // waited for it; it gets its guard now.
    pendingBacks -= 1;
    if (pendingBacks === 0) pushGuard();
    return;
  }
  if (onGuardEntry()) {
    // Forward, back onto a guard we had stepped off. Keep it only if
    // something is open to answer the next Back.
    guarded = true;
    if (layers.length === 0) stepOff();
    return;
  }
  // Back, off the guard. The top layer answers it. It may close (a dialog)
  // or decline (a battle that asks first), so the guard goes straight back
  // up while anything is still registered; a layer that does close then
  // steps off it again as it goes.
  guarded = false;
  const top = layers[layers.length - 1];
  if (!top) return;
  top.onBack();
  pushGuard();
}

// Leaving the page while the guard is the current entry (the Shop starts a
// Stripe checkout with a plain `location.href = url`) would push the new
// page after the guard, and the guard would outlive the page that answered
// for it: Back from the checkout landed on it, and it took an extra Back,
// which reloaded the game, to get past it. So a push away from the page
// replaces the guard instead, and the history is what it would have been
// without one. Where the Navigation API is missing, the extra entry stays.
function onNavigate(e) {
  if (!guarded || !onGuardEntry()) return;
  if (e.navigationType !== 'push' || e.destination.sameDocument || !e.cancelable) return;
  // A download or a form post is not a page that can simply be reloaded.
  if (e.downloadRequest != null || e.formData) return;
  if (!/^https?:$/.test(new URL(e.destination.url).protocol)) return;
  e.preventDefault();
  const leaving = window.navigation.navigate(e.destination.url, { history: 'replace' });
  // Never settled for a navigation that leaves the page; caught regardless.
  leaving.committed?.catch(() => {});
  leaving.finished?.catch(() => {});
}

function release(layer) {
  const i = layers.indexOf(layer);
  if (i === -1) return;
  layers.splice(i, 1);
  if (layers.length > 0 || !guarded) return;
  // Something else replaced our entry's state (a URL clean-up): it is no
  // longer ours to step off, and stepping back would leave a real page.
  if (!onGuardEntry()) {
    guarded = false;
    return;
  }
  stepOff();
}

/**
 * Route system Back to `onBack` while this layer is the top one. Returns the
 * release function; call it when the layer goes (a dialog unmounting, a
 * screen being left). Layers stack in the order they are held.
 *
 * @param {() => void} onBack what Back means here (close, return, ask)
 * @returns {() => void} release
 */
export function holdBack(onBack) {
  if (typeof window === 'undefined' || !window.history?.pushState) return () => {};
  if (!installed) {
    window.addEventListener('popstate', onPopState);
    window.navigation?.addEventListener?.('navigate', onNavigate);
    installed = true;
  }
  const layer = { onBack };
  layers.push(layer);
  pushGuard();
  return () => release(layer);
}

// For tests: forget every layer and stop listening, so each test starts with
// the module as a fresh page would have it.
export function resetHistoryGuard() {
  if (installed) {
    window.removeEventListener('popstate', onPopState);
    window.navigation?.removeEventListener?.('navigate', onNavigate);
  }
  installed = false;
  layers.length = 0;
  guarded = false;
  pendingBacks = 0;
}
