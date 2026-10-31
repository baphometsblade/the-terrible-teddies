// The toasts for a batch of unlocked achievements. The drawn version (each
// badge on a medallion, the coin icon: achievementToast.jsx) carries sixteen
// icons, about 1 kB gzip, and App is the entry chunk, so it loads with the
// first unlock rather than on first paint. If that chunk cannot be fetched
// (offline, a stale deploy), the same words go out without the drawing:
// the coins are already credited, and the player still hears about it.

// The House entering the unlock in the file. One line over a dialog at 320px
// (e2e/meta-screens.spec.js measures it); every achievement name reads as an
// entry on a record, so one constant serves them all.
export const ACHIEVEMENT_TOAST_TITLE = 'Behavior noted';

export const plainAchievementToast = (achievement) => ({
  title: ACHIEVEMENT_TOAST_TITLE,
  description: `${achievement.name} — +${achievement.reward.toLocaleString()} coins`,
});

const loadDrawn = () => import('./achievementToast.jsx');

/**
 * @param {object[]} achievements entries of ACHIEVEMENTS
 * @returns {Promise<object[]>} toast props, in the same order; never rejects
 */
export function achievementToasts(achievements, load = loadDrawn) {
  return Promise.resolve()
    .then(load)
    .then(
      ({ achievementToast }) => achievements.map(achievementToast),
      () => achievements.map(plainAchievementToast),
    );
}
