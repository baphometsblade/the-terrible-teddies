// The brass coin, on its own: TeddyCard strikes its cost on it, and TeddyCard
// is on the boot path (the main menu's hero cards), so this stays a leaf
// module. game-chrome.jsx re-exports it with the rest of the shared chrome;
// importing it from there would ship the whole of that module on first paint.

// The brass a card's cost is struck on (TeddyCard's cost coin), lit from above.
export const COIN_BRASS = 'radial-gradient(circle at 50% 30%, #fffbeb, #fbbf24 55%, #b45309)';

// `em` takes its size from the parent's font-size, like PackArt's mini packs,
// so a coin drawn into a pack-sized slot scales with it.
const COIN_SIZES = {
  card: 'h-[17px] w-[17px] text-[10px]',
  sm: 'h-6 w-6 text-xs',
  md: 'h-9 w-9 text-sm',
  lg: 'h-12 w-12 text-base',
  em: 'h-[3.6em] w-[3.6em]',
};

/**
 * A brass coin, optionally with a number struck on it (a cost). Without
 * children it is pure decoration and the caller hides it (aria-hidden).
 */
export const BrassCoin = ({ size = 'sm', className = '', children, ...rest }) => (
  <span
    className={`grid shrink-0 place-items-center rounded-full font-display font-extrabold leading-none text-night-950 tabular-nums ring-1 ring-night-950/80 shadow-[0_1px_3px_rgba(0,0,0,0.6)] ${COIN_SIZES[size] || COIN_SIZES.sm} ${className}`}
    style={{ background: COIN_BRASS }}
    {...rest}
  >
    {children}
  </span>
);
