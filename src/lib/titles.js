// House titles. A title is worn, not just unlocked: the achievement pays its
// coins either way, and wearing one is what the menu and the account show.
//
// The ids are the contract with set_house_title. titles.test.js fails if the
// migration's allowlist and this table drift, because a title the server
// refuses cannot be worn on the account and a title the client never offers
// is a string a console can still write.

export const TITLE_NAME_MAX = 16;

export const TITLES = Object.freeze([
  { id: 'lucky', name: 'Lucky Bastard', achievementId: 'first_win' },
  { id: 'counsel', name: 'Lawyered Up', achievementId: 'win_50' },
  { id: 'connected', name: 'Knows a Guy', achievementId: 'collect_all' },
  { id: 'too_old', name: 'Too Old for It', achievementId: 'level_25' },
  { id: 'seven', name: 'Week-Long Thing', achievementId: 'daily_7' },
  { id: 'regular', name: 'House Problem', achievementId: 'win_100' },
  { id: 'closing', name: 'Won’t Leave', achievementId: 'win_streak_10' },
  { id: 'upstairs', name: 'Has a Drawer', achievementId: 'level_50' },
  { id: 'staff', name: 'They Know You', achievementId: 'daily_30' },
  { id: 'last_call', name: 'Happy Ending', achievementId: 'comeback_3' },
].map((row) => Object.freeze(row)));

const BY_ID = new Map(TITLES.map((title) => [title.id, title]));
const BY_ACHIEVEMENT = new Map(TITLES.map((title) => [title.achievementId, title]));

/** The title with this id, or null. A prototype key is not a title. */
export const titleById = (id) => (typeof id === 'string' ? BY_ID.get(id) ?? null : null);

/** The title an achievement unlocks, or null when it unlocks none. */
export const titleForAchievement = (achievementId) => BY_ACHIEVEMENT.get(achievementId) ?? null;

/** Titles the player has earned, in table order. */
export const titlesEarned = (completedIds) => {
  const done = new Set(completedIds || []);
  return TITLES.filter((title) => done.has(title.achievementId));
};
