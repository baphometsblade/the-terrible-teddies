import { useEffect } from 'react';
import { useGameStore } from '../stores/gameStore';

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
 * Safe to run at any time, including mid-battle: the battle itself lives in
 * GameBoard's React state (health, fields, hands), not in this store, so a
 * rehydrate refreshes currency, collection and progression without disturbing
 * a game in progress — and the end-of-battle write then applies to the fresh
 * values rather than the stale ones. Nothing is lost by re-reading, either,
 * because persist writes on every `set`: this tab has no unsaved state to
 * overwrite, only older state to replace.
 */
export function useRehydrateOnFocus() {
  useEffect(() => {
    const rehydrate = () => {
      // visibilitychange fires for hiding as well as showing.
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
      useGameStore.persist?.rehydrate?.();
    };

    // Both, deliberately: visibilitychange covers switching tabs within a
    // window, focus covers switching between windows (or back from another
    // app), and neither alone catches both. Firing twice is harmless — a
    // rehydrate that finds the same data is a no-op set.
    window.addEventListener('focus', rehydrate);
    document.addEventListener('visibilitychange', rehydrate);
    return () => {
      window.removeEventListener('focus', rehydrate);
      document.removeEventListener('visibilitychange', rehydrate);
    };
  }, []);
}

export default useRehydrateOnFocus;
