import { useEffect } from 'react';
import { useGameStore } from '../stores/gameStore';
import { settlePendingPurchase } from './settlePendingPurchase';

/**
 * Re-read the persisted save whenever this tab comes back to the foreground.
 *
 * The store persists to one device-wide localStorage key, and zustand's persist
 * middleware serialises the WHOLE partialized state on every `set`. Two tabs
 * therefore last-writer-wins over each other's entire save, not per field:
 *
 *   Tab A: buy a Legendary pack (-200 gems, +10 cards), win three battles
 *          (coins, XP, a level, two achievements). All persisted.
 *   Tab B: still holds the snapshot it loaded before any of that. The player
 *          switches to it and plays one battle. recordBattleResult calls `set`,
 *          the middleware writes tab B's entire state over the key, and every
 *          card, coin, level and achievement from tab A is gone on next load.
 *
 * Purchased gems happen to self-heal — the rolled-back high-water mark falls
 * below the server total, so the next login re-credits the difference — but
 * coins, cards, levels and achievements have no server copy and are simply
 * lost, with nothing telling the player it happened.
 *
 * Rehydrating on focus closes the realistic path, because a tab cannot be
 * written to without first being interacted with, and interaction needs focus.
 * Focus arrives before the click that would have clobbered.
 *
 * Why this and not a `storage` event listener: `storage` fires the instant the
 * other tab writes, which can land mid-render or mid-battle and swap state
 * under a screen the player is reading. Focus is a moment the player has just
 * created, and the state they are about to act on is the state they will see.
 *
 * Mid-battle it still runs, because the end-of-battle write has to land on
 * the fresh save. A battle in progress is not in this store: GameBoard keeps
 * it in React state (health, fields, hands) and deals each game from a
 * snapshot of the deck and difficulty taken at deal time, once per game. It
 * once dealt from the live store instead, and since every rehydrate puts a
 * newly parsed deck array there, one alt-tab re-dealt the game in progress
 * (e2e/smoke.spec.js pins that it no longer does). Nothing is lost by
 * re-reading, either, because persist writes on every `set`: this tab has no
 * unsaved state to overwrite, only older state to replace.
 *
 * When the save still holds exactly what this tab last wrote — the usual
 * case, no other tab having touched it — there is nothing to read, and the
 * rehydrate is skipped rather than run as a "no-op": persist's rehydrate
 * always replaces every array and object in the state with a freshly parsed
 * copy, so each focus re-rendered every subscriber, and anything keyed on an
 * array's identity saw a change that was not one.
 */

// Whether the save in storage is the one this tab would write now: the same
// string persist itself writes on every `set` ({ state: partialize(state),
// version }, through JSON.stringify). Unreadable storage, or any doubt,
// answers no, and the rehydrate runs as it always did.
const holdsOwnSave = () => {
  try {
    const { name, partialize, version } = useGameStore.persist.getOptions();
    const raw = window.localStorage.getItem(name);
    if (raw === null) return false;
    const own = partialize ? partialize({ ...useGameStore.getState() }) : useGameStore.getState();
    return raw === JSON.stringify({ state: own, version });
  } catch {
    return false;
  }
};

export function useRehydrateOnFocus() {
  useEffect(() => {
    const rehydrate = async () => {
      // visibilitychange fires for hiding as well as showing.
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
      if (!holdsOwnSave()) await useGameStore.persist?.rehydrate?.();
      // Then, and only then, a payment still waiting on Stripe (see
      // settlePendingPurchase): its reconcile must land on the fresh save,
      // not be overwritten by the rehydrate. It does nothing, and sends
      // nothing, unless a payment is pending.
      settlePendingPurchase().catch((err) => console.error('Pending purchase check failed:', err));
    };

    // Both, deliberately: visibilitychange covers switching tabs within a
    // window, focus covers switching between windows (or back from another
    // app), and neither alone catches both. Firing twice is harmless: the
    // second reads the same save again, or, finding it already matches this
    // tab's state, skips.
    window.addEventListener('focus', rehydrate);
    document.addEventListener('visibilitychange', rehydrate);
    return () => {
      window.removeEventListener('focus', rehydrate);
      document.removeEventListener('visibilitychange', rehydrate);
    };
  }, []);
}

export default useRehydrateOnFocus;
