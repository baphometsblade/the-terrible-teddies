import { RARITY_METAL } from '@/lib/rarity';

// Small pieces of chrome every dialog header and balance row repeats. They were
// copy-pasted into each screen as the screens were redesigned; one definition
// keeps them identical.

const MEDALLION_SIZES = {
  sm: { box: 'h-11 w-11 p-[2px]', icon: 'h-5 w-5' },
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

/**
 * A currency balance on glass. The icon carries the meaning visually and the
 * sr-only noun carries it for a screen reader (aria-label on a role-less div
 * is prohibited in ARIA 1.2).
 */
export const BalanceChip = ({ icon: Icon, value, tone, noun, className = '' }) => (
  <div className={`panel-glass flex h-10 items-center gap-1.5 rounded-xl pl-2.5 pr-3 ${className}`}>
    <Icon aria-hidden="true" className={`h-4 w-4 ${tone}`} strokeWidth={2.4} />
    <span className={`font-display text-[15px] font-extrabold tabular-nums ${tone}`}>{value}</span>
    <span className="sr-only">{noun}</span>
  </div>
);
