// How hard a hit should feel. The battle log is the record; this only
// decides the shake, the gold number, and a short vibration where the
// browser actually has one. iOS Safari does not implement navigator.vibrate,
// so the call is feature-detected and a miss is a no-op.

export const CRIT_DAMAGE = 5;

/**
 * A crit is a kill, trample, or a swing of CRIT_DAMAGE or more.
 * `shake` is `lg` for a kill or trample, `sm` for a heavy hit that lives,
 * and null when the hit is ordinary. `haptic` is a vibrate pattern, or null.
 */
export const classifyHit = ({ dmg = 0, killed = false, overkill = 0 } = {}) => {
  const crit = killed || overkill > 0 || dmg >= CRIT_DAMAGE;
  if (!crit) return { crit: false, shake: null, haptic: null };
  const heavy = killed || overkill > 0;
  return {
    crit: true,
    shake: heavy ? 'lg' : 'sm',
    haptic: heavy ? [18, 30, 28] : [12],
  };
};

/** Stamp a floating-number event with the crit flag the card paints. */
export const withImpact = (event, impact) => (
  impact?.crit ? { ...event, crit: true, impact } : event
);

/** True when the Animations switch or the OS has asked the screen to sit still. */
export const motionReduced = () => {
  if (typeof document !== 'undefined' && document.documentElement.dataset.motion === 'off') return true;
  if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return true;
  return false;
};

/**
 * Buzz, if this browser can and the player has not asked for quiet.
 * Returns whether a vibration was requested. Never throws.
 */
export const pulseImpact = (impact, { reduced = false } = {}) => {
  if (reduced || !impact?.haptic) return false;
  const vibrate = typeof navigator !== 'undefined' ? navigator.vibrate : undefined;
  if (typeof vibrate !== 'function') return false;
  try {
    return vibrate.call(navigator, impact.haptic) !== false;
  } catch {
    return false;
  }
};

/** The strongest shake in a wave: a kill outranks a heavy hit. */
export const strongestShake = (events) => {
  let shake = null;
  let haptic = null;
  for (const event of events) {
    const impact = event?.impact;
    if (!impact?.shake) continue;
    if (impact.shake === 'lg' || !shake) {
      shake = impact.shake;
      haptic = impact;
    }
  }
  return shake ? { shake, impact: haptic } : null;
};
