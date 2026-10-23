import { Coins } from 'lucide-react';
import { Medallion } from '@/components/ui/medallion';
import { readingTime } from '@/components/ui/use-toast';
import { achievementIcon } from './achievementIcons';
import { ACHIEVEMENT_TOAST_TITLE } from './achievementAnnouncements';

// Loaded on demand by achievementAnnouncements.js, which says why.

/**
 * The announcement for an unlocked achievement, drawn as the level-up toast
 * is: its badge on a brass medallion, and the reward with the coin icon, not
 * the emoji and 🪙 it used to print (each platform draws those differently,
 * and they read as stickers beside the game's own icons).
 *
 * The description is markup, so the reading time is computed here from the
 * words a screen reader hears: "<name> — +<reward> coins".
 */
export function achievementToast(achievement) {
  const reward = `+${achievement.reward.toLocaleString()}`;
  return {
    title: ACHIEVEMENT_TOAST_TITLE,
    icon: <Medallion size="sm" icon={achievementIcon(achievement)} />,
    // Inline text, the amount and its coin bound together (whitespace-nowrap):
    // as two flex items, a wrap at 320 left the coin alone at the far edge.
    description: (
      <>
        {achievement.name} —{' '}
        <span className="whitespace-nowrap">
          {reward}
          <Coins className="ml-0.5 inline h-4 w-4 align-[-3px] text-brass-300" aria-hidden="true" strokeWidth={2.4} />
          <span className="sr-only"> coins</span>
        </span>
      </>
    ),
    duration: readingTime(ACHIEVEMENT_TOAST_TITLE, `${achievement.name} — ${reward} coins`),
  };
}
