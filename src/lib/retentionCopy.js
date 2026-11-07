// The lines Daily Rewards adds when a claim is more than the day's row in the
// table: a forgiven night, a long bender's extra coins, a banked shield, a
// tab kept while the player was gone. Empty for an ordinary night, which is
// what the panel measured in e2e still is.

import { comebackFor } from './comeback';
import { weekCoinBonus, streakWeek } from './loginStreak';

/** Short House lines for this resolution, in display order. No exclamation marks. */
export const loginNotes = (resolution, baseCoins) => {
  if (!resolution) return [];
  const notes = [];
  if (resolution.usedShield) {
    notes.push('Missed a night. We looked the other way. The streak still counts.');
  } else if (resolution.broken) {
    const back = comebackFor(resolution.gap);
    if (back) {
      notes.push(back.capped
        ? `Gone ${back.days} nights or more. The stool, and the rumour, waited.`
        : `Gone ${back.days} nights. The stool still smells like you.`);
    }
  }
  const bonus = weekCoinBonus(baseCoins, resolution.streak);
  if (!resolution.alreadyClaimed && bonus > 0) {
    notes.push(`Week ${streakWeek(resolution.streak)} is feeling generous: ${bonus.toLocaleString()} extra coins.`);
  }
  if (resolution.shieldRefilled && !resolution.alreadyClaimed) {
    notes.push('This one buys a free missed night. Spend it shamelessly.');
  }
  return notes;
};
