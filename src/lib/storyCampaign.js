// Two chapters. They do not start a fight. The fights the player already
// has are the beats, and the house talks over them.

const win = (n) => (state) => (state.totalWins || 0) >= n;
const fights = (n) => (state) => (state.totalBattles || 0) >= n;
const cards = (n) => (state) => (state.ownedCards || []).length >= n;
const level = (n) => (state) => (state.level || 1) >= n;
const damage = (n) => (state) => (state.totalDamageDealt || 0) >= n;

export const STORY_CHAPTERS = Object.freeze([
  {
    id: 'story_first_round',
    name: 'The First Round',
    opening: 'You walked in. The room decided you were staying.',
    closing: 'The bartender used your name. You are in trouble.',
    requires: null,
    coins: 150,
    packs: 1,
    beats: Object.freeze([
      Object.freeze({ id: 'win', label: 'Win a fight', met: win(1) }),
      Object.freeze({ id: 'nights', label: 'Sit three fights', met: fights(3) }),
      Object.freeze({ id: 'cards', label: 'Take fifteen home', met: cards(15) }),
    ]),
  },
  {
    id: 'story_lock_in',
    name: 'The Lock-in',
    opening: 'They locked the door. Nobody asked you to leave.',
    closing: 'You have a key. Try not to lose it down someone’s dress.',
    requires: 'story_first_round',
    coins: 400,
    packs: 2,
    beats: Object.freeze([
      Object.freeze({ id: 'wins', label: 'Win eight fights', met: win(8) }),
      Object.freeze({ id: 'level', label: 'Reach level 5', met: level(5) }),
      Object.freeze({ id: 'damage', label: 'Deal 200 damage', met: damage(200) }),
    ]),
  },
].map((row) => Object.freeze(row)));

export const storyChapters = (state = {}) => {
  const claimed = new Set(state.claimedChapters || []);
  return STORY_CHAPTERS.map((chapter) => {
    const locked = Boolean(chapter.requires) && !claimed.has(chapter.requires);
    const beats = chapter.beats.map((beat) => ({ id: beat.id, label: beat.label, met: !locked && beat.met(state) }));
    const ready = !locked && beats.every((beat) => beat.met);
    return {
      id: chapter.id,
      name: chapter.name,
      opening: chapter.opening,
      closing: chapter.closing,
      coins: chapter.coins,
      packs: chapter.packs,
      locked,
      claimed: claimed.has(chapter.id),
      ready,
      beats,
    };
  });
};
