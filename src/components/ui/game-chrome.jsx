import { Coins, Gem, Package } from 'lucide-react';
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

// One pip per pack tier, in the metal its pack wears (PACK_LOOK in PackArt):
// pewter, amethyst, brass. Read from RARITY_METAL directly so this ui module
// does not import a screen's component.
const PACK_TIERS = [
  { key: 'regular', metal: RARITY_METAL.common, noun: 'standard' },
  { key: 'premium', metal: RARITY_METAL.epic, noun: 'premium' },
  { key: 'legendary', metal: RARITY_METAL.legendary, noun: 'legendary' },
];

/**
 * Packs waiting to be opened: the total, and a metal pip for each special tier
 * held. Replaces the "1 (0+0P+1L)" notation the Card Packs header used to
 * print. The pips only appear once a Premium or Legendary pack is held — a
 * lone pewter dot beside a count of standard packs said nothing.
 */
export const PackBalanceChip = ({ regular = 0, premium = 0, legendary = 0, className = '' }) => {
  const counts = { regular, premium, legendary };
  const total = regular + premium + legendary;
  const held = PACK_TIERS.filter((t) => counts[t.key] > 0);
  const showPips = premium > 0 || legendary > 0;
  const breakdown = held.map((t) => `${counts[t.key]} ${t.noun}`).join(', ');
  return (
    <div className={`panel-glass flex h-10 items-center gap-1.5 rounded-xl pl-2.5 pr-3 ${className}`}>
      <Package aria-hidden="true" className="h-4 w-4 text-sky-300" strokeWidth={2.4} />
      <span className="font-display text-[15px] font-extrabold tabular-nums text-sky-300">{total.toLocaleString()}</span>
      {showPips && (
        <span aria-hidden="true" data-pack-pips="" className="ml-0.5 flex items-center gap-1">
          {held.map((t) => (
            <span key={t.key} className="h-2.5 w-2.5 rounded-full ring-1 ring-black/50" style={{ background: t.metal }} />
          ))}
        </span>
      )}
      <span className="sr-only">{`packs to open${showPips ? `: ${breakdown}` : ''}`}</span>
    </div>
  );
};

/**
 * The wallet row every store dialog puts in its header: coins, gems and (where
 * packs matter) the packs waiting to be opened. Each balance is optional — pass
 * only the ones a screen deals in — and `children` appends to the same row, so
 * a screen can put a control (a route to buy gems, say) beside its balances
 * without building a second row.
 *
 * `packs` is { regular, premium, legendary }, the three store counters.
 */
export const WalletChips = ({ coins, gems, packs, className = '', children }) => (
  <div className={`flex flex-wrap items-center gap-2 ${className}`}>
    {coins !== undefined && (
      <BalanceChip icon={Coins} tone="text-brass-300" noun="coins" value={coins.toLocaleString()} />
    )}
    {gems !== undefined && (
      <BalanceChip icon={Gem} tone="text-fuchsia-300" noun="gems" value={gems.toLocaleString()} />
    )}
    {packs && <PackBalanceChip {...packs} />}
    {children}
  </div>
);

/** A section's small-caps label with a hairline fading off to its right. */
export const SectionHeading = ({ children, as: Tag = 'h3', id, className = 'mb-3' }) => (
  <div className={`flex items-center gap-3 ${className}`}>
    <Tag id={id} className="label-caps text-plush-300 shrink-0">{children}</Tag>
    <span aria-hidden="true" className="h-px flex-1 bg-gradient-to-r from-white/10 to-transparent" />
  </div>
);

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
