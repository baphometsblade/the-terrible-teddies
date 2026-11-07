// The gift the morning after a fight. No battle yesterday, no gift: going
// home sober does not earn a hangover.

export const MORNING_AFTER = Object.freeze({
  coins: 40,
  name: 'Hair of the dog',
  line: 'Your head is writing cheques. The house covers one.',
});

export const morningAfterDue = ({ lastBattleDate = null, morningAfterDate = null } = {}, now = new Date()) => {
  if (!lastBattleDate) return false;
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  return lastBattleDate === yesterday.toDateString() && morningAfterDate !== now.toDateString();
};
