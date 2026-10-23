import { useId } from 'react';
import { X } from 'lucide-react';
import { PACK_ODDS, PACK_SLOTS } from '@/stores/gameStore';
import { RARITY, RARITY_METAL, RARITY_ORDER } from '@/lib/rarity';
import { useDialog } from '@/hooks/useDialog';
import { FOCUS_OUTLINE } from '@/lib/focus';
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
      <span key={rarity} className={`inline-flex items-center gap-1.5 whitespace-nowrap ${RARITY[rarity].text}`}>
        <span aria-hidden="true" className="w-2 h-2 rounded-full" style={{ background: RARITY_METAL[rarity] }} />
        {label(rarity)} {pct}
      </span>
    ))}
  </span>
);

/**
 * The Card Packs drop-rate guide: the standard table once, then each better
 * tier's first card. The guaranteed slot IS what those tiers are sold on, so
 * posting the standard table alone understated exactly what was being paid for.
 */
export const PackOddsGuide = () => {
  const standard = describePackOdds('regular');
  const better = TIERS.filter((t) => PACK_SLOTS[t].first !== 'standard').map((t) => describePackOdds(t));
  return (
    <div className="text-center">
      <h3 className="label-caps tracking-[0.1em] sm:tracking-[0.16em] text-plush-300 mb-2.5">Drop rates — per card</h3>
      <dl className="inline-grid gap-2.5 text-left sm:grid-cols-[auto_1fr] sm:gap-x-4 sm:gap-y-2">
        <dt className="text-[11px] font-semibold text-plush-200">
          {`${TIER_NAME.regular} · every card`}
        </dt>
        <dd><OddsRow rows={standard.lines[0].rows} /></dd>
        {better.map((d) => (
          <div key={d.tier} className="contents">
            <dt className="text-[11px] font-semibold text-plush-200">{`${TIER_NAME[d.tier]} · first card`}</dt>
            <dd>
              <OddsRow rows={d.lines[0].rows} />
              <span className="block mt-0.5 text-[11px] text-plush-300">
                {`${d.lines[1].label} as a ${TIER_NAME.regular} · ${d.size} cards in all`}
              </span>
            </dd>
          </div>
        ))}
      </dl>
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
    <div className="fixed inset-0 z-[60] dialog-scrim flex items-start justify-center p-3 sm:p-6 overflow-y-auto">
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative my-auto w-full max-w-lg rounded-2xl dialog-panel px-5 pt-5 pb-6 sm:px-6"
      >
        <div className="flex items-center gap-3">
          <h2 id={titleId} className="mr-auto font-display text-2xl font-extrabold leading-none text-brass-gradient">Pack odds</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close pack odds"
            className={`btn-glass grid place-items-center w-10 h-10 shrink-0 rounded-xl ${FOCUS_OUTLINE}`}
          >
            <X aria-hidden="true" className="w-5 h-5" strokeWidth={2.4} />
          </button>
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
          Every card is rolled on its own. Within a rarity each card is equally likely, and a card you
          already own pays out coins instead.
        </p>
      </div>
    </div>
  );
};
