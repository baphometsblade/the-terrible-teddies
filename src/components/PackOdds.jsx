import { useId } from 'react';
import { PACK_ODDS, PACK_SLOTS } from '@/stores/gameStore';
import { SELLBACK_RATE } from '@/lib/packEconomy';
import { RARITY, RARITY_METAL, RARITY_ORDER } from '@/lib/rarity';
import { useDialog } from '@/hooks/useDialog';
import { SCRIM_PAD } from '@/lib/safeArea';
import { DialogClose } from '@/components/ui/game-chrome';
import { PACK_LOOK } from './PackArt';

// The posted odds, rendered from the table the roll uses (PACK_ODDS). Two of
// the three tiers are sold for gems, which are bought with real money, so
// these have to be shown before purchase and have to be the real numbers:
// they used to be string literals beside the roll, and only the standard table
// was posted at all.

export const TIER_NAME = { regular: 'Card Pack', premium: 'Premium Pack', legendary: 'Legendary Pack' };
const TIERS = ['regular', 'premium', 'legendary'];
const label = (rarity) => rarity.charAt(0).toUpperCase() + rarity.slice(1);

const percent = (weight, total) => {
  const p = (weight / total) * 100;
  return `${Number.isInteger(p) ? p : Number(p.toFixed(1))}%`;
};

/** One odds table as display rows, commonest first: [{ rarity, pct }]. */
export const oddsRows = (table) => {
  const total = table.reduce((n, [, w]) => n + w, 0);
  return [...table]
    .sort((a, b) => RARITY_ORDER.indexOf(a[0]) - RARITY_ORDER.indexOf(b[0]))
    .map(([rarity, weight]) => ({ rarity, pct: percent(weight, total) }));
};

/**
 * What a tier's pack holds, card by card: its size, and one line per distinct
 * table its cards roll on. Read at call time, so the screens follow a retune.
 */
export const describePackOdds = (tier, odds = PACK_ODDS, slots = PACK_SLOTS) => {
  const { size, first } = slots[tier];
  if (first === 'standard') {
    return { tier, size, lines: [{ label: 'Every card', rows: oddsRows(odds.standard) }] };
  }
  return {
    tier,
    size,
    lines: [
      { label: 'First card', rows: oddsRows(odds[first]) },
      { label: `Other ${size - 1} cards`, rows: oddsRows(odds.standard) },
    ],
  };
};

/** A row of rarity chances: a metal dot, the rarity, its chance. */
export const OddsRow = ({ rows, className = '' }) => (
  <span className={`flex flex-wrap gap-x-3.5 gap-y-1 text-xs font-semibold ${className}`}>
    {rows.map(({ rarity, pct }) => (
      <span key={rarity} data-rarity-ink={rarity} className={`inline-flex items-center gap-1.5 whitespace-nowrap ${RARITY[rarity].text}`}>
        <span aria-hidden="true" data-rarity-metal={rarity} className="w-2 h-2 rounded-full" style={{ background: RARITY_METAL[rarity] }} />
        {label(rarity)} {pct}
      </span>
    ))}
  </span>
);

/**
 * The Card Packs drop-rate guide. Gem packs and earned packs share this
 * table, the pity timer and the sell-back, so it is posted once and said so.
 */
export const PackOddsGuide = () => {
  const standard = describePackOdds('regular');
  return (
    <div className="text-center">
      <h3 className="label-caps tracking-[0.1em] sm:tracking-[0.16em] text-plush-300 mb-2.5">Drop rates — per card</h3>
      <dl className="inline-grid gap-2.5 text-left sm:grid-cols-[auto_1fr] sm:gap-x-4 sm:gap-y-2">
        <dt className="text-[11px] font-semibold text-plush-200">
          {`${TIER_NAME.regular} · every card`}
        </dt>
        <dd><OddsRow rows={standard.lines[0].rows} /></dd>
      </dl>
      <p className="mx-auto mt-2 max-w-md text-[11px] leading-relaxed text-plush-300">
        Premium Pack and Legendary Pack use these same odds, the same pity and the same sell-back. Gems buy time, not better cards.
      </p>
    </div>
  );
};

/**
 * Every tier's odds in a dialog, opened from the Shop before a purchase.
 * Hosts its own useDialog, so it owns Escape and the focus trap while it is up
 * and hands focus back to the control that opened it.
 */
export const PackOddsDialog = ({ onClose }) => {
  const ref = useDialog(onClose);
  const titleId = useId();
  return (
    <div className={`fixed inset-0 z-[60] dialog-scrim flex items-start justify-center ${SCRIM_PAD} overflow-y-auto`}>
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative my-auto w-full max-w-lg rounded-2xl dialog-panel px-5 pt-5 pb-6 sm:px-6"
      >
        <div className="flex items-center gap-3">
          <h2 id={titleId} className="mr-auto font-display text-2xl font-extrabold leading-none text-brass-gradient">Pack odds</h2>
          <DialogClose label="Close pack odds" onClick={onClose} />
        </div>
        <p className="mt-2 text-sm text-plush-300">
          The chance of each rarity, card by card — the same table the game rolls on.
        </p>
        <div className="mt-4 space-y-3">
          {TIERS.map((tier) => {
            const d = describePackOdds(tier);
            return (
              <section
                key={tier}
                aria-label={TIER_NAME[tier]}
                className="panel-glass relative overflow-hidden rounded-xl p-3.5"
              >
                <span
                  aria-hidden="true"
                  className="absolute inset-0 pointer-events-none"
                  style={{ background: `radial-gradient(ellipse 60% 90% at 0% 0%, ${PACK_LOOK[tier].light}, transparent 70%)` }}
                />
                <h3 className="relative flex items-baseline justify-between gap-3">
                  <span className="font-display text-lg font-extrabold text-white">{TIER_NAME[tier]}</span>
                  <span className="text-xs font-semibold text-plush-300">{`${d.size} cards`}</span>
                </h3>
                <dl className="relative mt-2 space-y-2">
                  {d.lines.map((line) => (
                    <div key={line.label}>
                      <dt className="label-caps text-[10px] text-plush-300">{line.label}</dt>
                      <dd className="mt-1"><OddsRow rows={line.rows} /></dd>
                    </div>
                  ))}
                </dl>
              </section>
            );
          })}
        </div>
        <p className="mt-4 text-xs leading-relaxed text-plush-300">
          {`Every card is rolled on this one table, whichever pack you bought. A rare or better lands at least every ${10} packs. Duplicates sell back at ${Math.round(SELLBACK_RATE * 100)}% of the bar price, less after the day’s cap. Every 6th pack pays a coin bonus. Gem packs use these same odds, the same pity and the same sell-back. They do not roll better cards.`}
        </p>
      </div>
    </div>
  );
};
