import { useState } from 'react';
import { Check, BookOpen } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { useGameStore, ALL_CARDS, coinsForDuplicate } from '../stores/gameStore';
import { bookOf } from '@/lib/collectionBook';
import { BUNDLED_SEASON_IDS, evergreenCards } from '@/data/seasonsCatalog';
import { showInAlbum } from '@/lib/seasons';
import { useVisibleSeasons } from '@/hooks/useSeasonSnapshot';
import VaultMark from './VaultMark';
import { nextStarTarget, starCost, starSetReady, starringUnlocked, starCount } from '@/lib/cardStars';
import { starMark } from '@/lib/retentionMarks';
import { claimRetentionMark } from '@/utils/supabaseClient';
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
const SetRow = ({ row, claimed, onClaim, star, onStar, starReady, starClaimed, onStarClaim }) => {
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
        {star && (
          <button
            type="button"
            onClick={onStar}
            className={`btn-glass h-11 rounded-lg px-3 font-display text-sm font-bold ${FOCUS_OUTLINE}`}
          >
            Another round, {star.cost} coins
          </button>
        )}
        {starReady && !starClaimed && (
          <button
            type="button"
            onClick={onStarClaim}
            className={`btn-brass h-11 rounded-lg px-3 font-display text-sm font-bold ${FOCUS_OUTLINE}`}
          >
            They all stayed
          </button>
        )}
        {starClaimed && <span className="text-sm text-plush-300">The whole tier came home.</span>}
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
  const {
    ownedCards, claimedSets, claimCollectionSet, cardStars, coins, claimedStarSets,
    raiseCardStar, claimStarSet,
  } = useGameStore();
  const seasons = useVisibleSeasons();
  const evergreen = evergreenCards(ALL_CARDS);
  const rows = bookOf(evergreen, ownedCards);
  const seasonal = ALL_CARDS.filter((card) => (
    BUNDLED_SEASON_IDS.has(card.id) && showInAlbum(card.id, ownedCards.includes(card.id), seasons, BUNDLED_SEASON_IDS)
  ));
  const [said, setSaid] = useState('');
  const starsOpen = starringUnlocked(ownedCards);

  const claim = (row) => {
    const paid = claimCollectionSet(row.id);
    if (!paid) return;
    setSaid(`${row.name} claimed: ${rewardWords(paid)}.`);
  };

  const star = (row) => {
    const paid = raiseCardStar(row.id);
    if (!paid) return;
    setSaid(`${paid.name} came home again. Star ${paid.stars}.`);
  };

  const starSet = (row) => {
    const paid = claimStarSet(row.id);
    if (!paid) return;
    claimRetentionMark(starMark(row.id));
    setSaid(`${row.name}: they all stayed. ${rewardWords(paid)}.`);
  };

  return (
    <div className="mb-8 space-y-3">
      <div className="flex items-center gap-2 px-1">
        <BookOpen aria-hidden="true" className="h-4 w-4 text-brass-300" strokeWidth={2.2} />
        <p className="text-sm text-plush-300">
          {starsOpen
            ? 'Fill a tier. Stars are another night with them. They do not hit harder.'
            : 'Fill a tier. The house buys the next round, once.'}
        </p>
      </div>
      <div role="status" className="sr-only">{said}</div>
      {seasonal.length > 0 && (
        <section className="panel-glass rounded-2xl p-4">
          <h2 className="font-display text-lg font-extrabold text-white">The Naughty List</h2>
          <p className="mt-1 text-sm text-plush-200">Office party. They leave the packs when the night does. Copies you own stay.</p>
          <ul className="mt-3 space-y-2">
            {seasonal.map((card) => (
              <li key={card.id} className="text-sm text-plush-200">
                <span className="font-semibold text-white">{card.name}</span>
                <span className="text-plush-300"> · {card.rarity} · {card.cost} cost · {card.attack}/{card.defense}</span>
                {ownedCards.includes(card.id) ? <span className="text-plush-300"> · owned</span> : null}
                <span className="mt-1 block"><VaultMark cardId={card.id} seasons={seasons} /></span>
              </li>
            ))}
          </ul>
        </section>
      )}
      {rows.map((row) => {
        const target = starsOpen ? nextStarTarget(evergreen, ownedCards, cardStars, row.id) : null;
        const cost = target ? starCost(target.id, cardStars, coinsForDuplicate) : null;
        const starred = evergreen
          .filter((card) => card.rarity === row.id && ownedCards.includes(card.id))
          .reduce((n, card) => n + (starCount(cardStars, card.id) > 0 ? 1 : 0), 0);
        return (
          <SetRow
            key={row.id}
            row={{ ...row, blurb: starsOpen && starred ? `${row.blurb} ${starred} starred.` : row.blurb }}
            claimed={claimedSets.includes(row.id)}
            onClaim={() => claim(row)}
            star={target && cost != null && coins >= cost ? { cost } : null}
            onStar={() => star(row)}
            starReady={starsOpen && starSetReady(ALL_CARDS, ownedCards, cardStars, row.id)}
            starClaimed={claimedStarSets.includes(row.id)}
            onStarClaim={() => starSet(row)}
          />
        );
      })}
    </div>
  );
};

export default CollectionBook;
