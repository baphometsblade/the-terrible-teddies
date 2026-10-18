import confetti from 'canvas-confetti';
import { useGameStore } from '@/stores/gameStore';

/**
 * Fire confetti, unless the player has asked for less motion.
 *
 * Every burst in the game goes through here. canvas-confetti draws on its own
 * canvas from JavaScript, so it is the one effect neither switch reaches on its
 * own: MotionConfig governs Framer Motion only, and the [data-motion="off"] CSS
 * rules govern only CSS animations. With Animations off in Settings, a
 * Legendary pack still fired a full-screen burst for every epic it held.
 *
 * Skips the burst when the store's animationsEnabled is false, and passes
 * canvas-confetti's own disableForReducedMotion so the OS-level preference is
 * honoured too. Returns what confetti returns (a promise), or null when skipped.
 */
export function celebrate(options = {}) {
  if (!useGameStore.getState().animationsEnabled) return null;
  return confetti({ disableForReducedMotion: true, ...options });
}
