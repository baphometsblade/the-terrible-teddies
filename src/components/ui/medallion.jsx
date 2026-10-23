import { RARITY_METAL } from '@/lib/rarity';

// The badge every dialog heads with, on its own: App draws one on the
// level-up toast, and App is the entry chunk, so this stays a leaf module.
// game-chrome.jsx re-exports it with the rest of the shared chrome; importing
// it from there would ship the whole of that module on first paint.

const MEDALLION_SIZES = {
  // A reward drawn on a Battle Pass tile, in the tile's 32px art slot.
  xs: { box: 'h-8 w-8 p-[2px]', icon: 'h-4 w-4' },
  sm: { box: 'h-11 w-11 p-[2px]', icon: 'h-5 w-5' },
  // The Battle Pass header's, which steps up with its title at lg.
  smToLg: { box: 'h-12 w-12 p-[2px] lg:h-14 lg:w-14', icon: 'h-6 w-6 lg:h-7 lg:w-7' },
  md: { box: 'h-14 w-14 p-[2px]', icon: 'h-6 w-6' },
  lg: { box: 'h-16 w-16 p-[3px]', icon: 'h-7 w-7' },
};

/**
 * A metal-ringed disc holding an icon: the badge at the head of every dialog.
 * Decorative — the dialog's title says what it is — so it is aria-hidden.
 *
 * `metal` is a RARITY_METAL gradient (brass by default). Pass `children` to put
 * something other than an icon on the disc (an emoji, a number).
 */
export const Medallion = ({
  icon: Icon, metal = RARITY_METAL.legendary, size = 'sm', className = '',
  iconClassName = 'text-brass-300', discClassName = '', children,
}) => {
  const s = MEDALLION_SIZES[size] || MEDALLION_SIZES.sm;
  return (
    <span
      aria-hidden="true"
      className={`relative inline-block shrink-0 rounded-full ${s.box} ${className}`}
      style={{ background: metal }}
    >
      <span className={`grid h-full w-full place-items-center rounded-full bg-night-900 ${discClassName}`}>
        {children ?? (Icon && <Icon className={`${s.icon} ${iconClassName}`} strokeWidth={2} />)}
      </span>
    </span>
  );
};
