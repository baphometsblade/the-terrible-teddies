// The toasts for a batch of unlocked achievements. The drawn version (each
// badge on a medallion, the coin icon: achievementToast.jsx) carries sixteen
// icons, about 1 kB gzip, and App is the entry chunk, so it loads with the
// first unlock rather than on first paint. If that chunk cannot be fetched
// (offline, a stale deploy), the same words go out without the drawing:
// the coins are already credited, and the player still hears about it.

export const ACHIEVEMENT_TOAST_TITLE = 'Achievement Unlocked!';

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
