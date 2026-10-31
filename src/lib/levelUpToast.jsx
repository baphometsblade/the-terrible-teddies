import { Coins } from 'lucide-react';
import { Medallion } from '@/components/ui/medallion';
import { readingTime } from '@/components/ui/use-toast';
import { rankUp } from './houseRank';

// The bonus's label. A level-up that carries a rank line says "Bonus:" instead:
// on a 360px phone the medallion is back and the description is 162px wide,
// where "Level-up bonus: +1,000" takes two lines on its own and the rank's line
// would make three, which reaches the controls under a dialog's header. Both
// are plain words, not a template: a rewrite changes them here and nowhere else.
const BONUS_LABEL = 'Level-up bonus:';
const BONUS_LABEL_WITH_RANK = 'Bonus:';

/**
 * The announcement for a level-up earned away from a battle's result screen
 * (App says when), drawn as the result panel draws it: the level struck on a
 * medallion and a coin icon, not ⭐ and 🪙, which render differently on every
 * platform and read as stickers next to the UI.
 *
 * A level-up that reaches a new house rank says so once, in a line of its own
 * under the bonus (houseRank.js: the rank is worked out from the level, so
 * there is nothing to remember that it was said; App's queue dedupe by id is
 * what keeps it to once). `levelsGained` is how many levels the one entry
 * covers, so a jump over several rungs starts from the level it started on and
 * says one promotion. The title stays "Level N!", one line over a dialog.
 *
 * The description is markup, so the reading time is computed here from the
 * words a screen reader hears.
 */
export function levelUpToast({ level, levelsGained = 1, bonusCoins }) {
  const title = `Level ${level}!`;
  const bonus = `+${bonusCoins.toLocaleString()}`;
  const promoted = rankUp(level - levelsGained, level)?.promoted;
  const label = promoted ? BONUS_LABEL_WITH_RANK : BONUS_LABEL;
  return {
    title,
    icon: (
      <Medallion size="sm">
        <span className="font-display text-lg font-extrabold leading-none text-brass-200">{level}</span>
      </Medallion>
    ),
    // Inline text, with the amount and its coin bound together: as two
    // flex items, a wrap at 320 left the coin alone at the far edge.
    // With a promotion the sr-only text ends its sentence, so a screen
    // reader pauses before the line instead of running the two together.
    // The line is a block of its own: the description holds the bonus and
    // one short line of it over a dialog (RANK_PROMOTED_MAX), which
    // e2e/meta-screens.spec.js measures for every rung's line at every width.
    description: (
      <>
        {label}{' '}
        <span className="whitespace-nowrap">
          {bonus}
          <Coins className="ml-0.5 inline h-4 w-4 align-[-3px] text-brass-300" aria-hidden="true" strokeWidth={2.4} />
          <span className="sr-only"> coins{promoted ? '.' : ''}</span>
        </span>
        {promoted && (
          <>
            {' '}
            <span className="block" data-rank-up="">{promoted}</span>
          </>
        )}
      </>
    ),
    duration: readingTime(title, `${label} ${bonus} coins${promoted ? `. ${promoted}` : ''}`),
  };
}
