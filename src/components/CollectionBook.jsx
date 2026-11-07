import { useState } from 'react';
import { Check, BookOpen } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { useGameStore, ALL_CARDS } from '../stores/gameStore';
import { bookOf } from '@/lib/collectionBook';
import { FOCUS_OUTLINE } from '@/lib/focus';
import { RARITY_METAL } from '@/lib/rarity';

const rewardWords = (reward) => {
  const parts = [];
  if (reward.coins) parts.push(`${reward.coins.toLocaleString()} coins`);
  if (reward.packs) parts.push(`${reward.packs} ${reward.packs === 1 ? 'card pack' : 'card packs'}`);
  return parts.join(' and ');
};

// One rarity, owned and missing, with its completion reward. Missing names
// stay behind a control so a set of twenty does not bury the next one.
const SetRow = ({ row, claimed, onClaim }) => {
  const [open, setOpen] = useState(false);
  const percent = row.total ? (row.owned / row.total) * 100 : 0;
  return (
    <section className="panel-glass rounded-2xl p-4">
      <div className="flex items-start gap-3">
        <span
          aria-hidden="true"
          className="mt-1 h-3 w-3 shrink-0 rounded-full ring-1 ring-black/40"
          style={{ background: RARITY_METAL[row.id] }}
        />
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-lg font-extrabold leading-tight text-white">{row.name}</h2>
          <p className="mt-0.5 text-sm text-plush-200">{row.blurb}</p>
          <p className="mt-0.5 text-sm text-plush-300">
            <span className="tabular-nums">{row.owned} of {row.total}</span>
            {' · '}
            {rewardWords(row.reward)}
          </p>
          <Progress
            value={percent}
            aria-label={`${row.name}: ${row.owned} of ${row.total}`}
            className="mt-3 h-2 bg-night-950/70 ring-1 ring-inset ring-white/[0.06] [&>div]:bg-gradient-to-r [&>div]:from-brass-200 [&>div]:to-brass-500"
          />
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {row.missing.length > 0 && (
          <button
            type="button"
            aria-expanded={open}
            onClick={() => setOpen((value) => !value)}
            className={`btn-glass h-11 rounded-lg px-3 font-display text-sm font-bold ${FOCUS_OUTLINE}`}
          >
            {open ? 'Hide the list' : `Haven’t had, ${row.missing.length}`}
          </button>
        )}
        {row.complete && !claimed && (
          <button
            type="button"
            onClick={onClaim}
            className={`btn-brass h-11 rounded-lg px-4 font-display text-sm font-bold ${FOCUS_OUTLINE}`}
          >
            Claim
          </button>
        )}
        {claimed && (
          <span className="inline-flex h-11 items-center gap-1.5 rounded-lg px-3 text-sm font-semibold text-plush-200">
            <Check aria-hidden="true" className="h-4 w-4 text-emerald-300" strokeWidth={3} />
            Claimed
          </span>
        )}
        {row.complete && !claimed && (
          <span className="sr-only">{row.name} is complete.</span>
        )}
      </div>

      {open && row.missing.length > 0 && (
        <ul className="mt-3 space-y-1 border-t border-white/10 pt-3">
          {row.missing.map((card) => (
            <li key={card.id} className="text-sm text-plush-200">{card.name}</li>
          ))}
        </ul>
      )}
    </section>
  );
};

const CollectionBook = () => {
  const { ownedCards, claimedSets, claimCollectionSet } = useGameStore();
  const rows = bookOf(ALL_CARDS, ownedCards);
  const [said, setSaid] = useState('');

  const claim = (row) => {
    const paid = claimCollectionSet(row.id);
    if (!paid) return;
    setSaid(`${row.name} claimed: ${rewardWords(paid)}.`);
  };

  return (
    <div className="mb-8 space-y-3">
      <div className="flex items-center gap-2 px-1">
        <BookOpen aria-hidden="true" className="h-4 w-4 text-brass-300" strokeWidth={2.2} />
        <p className="text-sm text-plush-300">Fill a tier. The house buys the next round, once.</p>
      </div>
      <div role="status" className="sr-only">{said}</div>
      {rows.map((row) => (
        <SetRow
          key={row.id}
          row={row}
          claimed={claimedSets.includes(row.id)}
          onClaim={() => claim(row)}
        />
      ))}
    </div>
  );
};

export default CollectionBook;
