import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { ACHIEVEMENTS } from '@/stores/gameStore';
import { readingTime } from '@/components/ui/use-toast';
import { ACHIEVEMENT_ICONS, achievementIcon } from './achievementIcons';
import { achievementToast } from './achievementToast';
import { achievementToasts, plainAchievementToast, ACHIEVEMENT_TOAST_TITLE } from './achievementAnnouncements';

// Any pictographic character: what the achievement data and its toast used to
// carry (🏆 … 📅 and the 🪙 after the reward).
const EMOJI = /\p{Extended_Pictographic}/u;

const html = (node) => renderToStaticMarkup(<>{node}</>);
const text = (node) => html(node).replace(/<[^>]+>/g, '');

describe('achievement badges', () => {
  // A name ACHIEVEMENT_ICONS does not know falls back to a trophy, so a typo
  // or a new achievement without an icon would quietly all look alike.
  it('names an icon the map draws, for every achievement', () => {
    expect(ACHIEVEMENTS.filter((a) => !Object.hasOwn(ACHIEVEMENT_ICONS, a.icon)).map((a) => a.id)).toEqual([]);
  });

  it('carries no emoji in the achievement data', () => {
    for (const a of ACHIEVEMENTS) expect(`${a.icon} ${a.name}`, a.id).not.toMatch(EMOJI);
  });

  it('gives each achievement a badge of its own', () => {
    const icons = ACHIEVEMENTS.map((a) => a.icon);
    expect(new Set(icons).size).toBe(icons.length);
  });

  it('falls back to a trophy rather than nothing, prototype names included', () => {
    expect(achievementIcon({ icon: 'NoSuchIcon' })).toBe(ACHIEVEMENT_ICONS.Trophy);
    expect(achievementIcon({ icon: 'constructor' })).toBe(ACHIEVEMENT_ICONS.Trophy);
    expect(achievementIcon(null)).toBe(ACHIEVEMENT_ICONS.Trophy);
  });
});

describe('the unlock toast', () => {
  const longest = [...ACHIEVEMENTS].sort((a, b) => b.name.length - a.name.length)[0];

  it.each(ACHIEVEMENTS.map((a) => [a.id, a]))('%s says what was unlocked and its reward, with no emoji', (_id, a) => {
    const t = achievementToast(a);
    expect(t.title).toBe(ACHIEVEMENT_TOAST_TITLE);
    // Read aloud: the name, then the reward in words ("coins" is sr-only).
    expect(text(t.description)).toBe(`${a.name} — +${a.reward.toLocaleString()} coins`);
    expect(`${t.title} ${text(t.description)}`).not.toMatch(EMOJI);
  });

  it('draws the badge on the medallion, hidden from screen readers', () => {
    const icon = html(achievementToast(longest).icon);
    expect(icon).toMatch(/^<span aria-hidden="true"/);
    expect(icon).toContain('<svg');
    expect(icon).toContain(`lucide-${longest.icon.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase()}`);
  });

  it('binds the amount and its coin so a wrap cannot split them', () => {
    const description = html(achievementToast(longest).description);
    expect(description).toMatch(/<span class="whitespace-nowrap">\+[\d,]+<svg[^>]*aria-hidden="true"/);
  });

  // The description is markup, which use-toast cannot measure, so the toast
  // must bring its own reading time or it falls back to the shortest one.
  it('stays up for the time its words take to read', () => {
    const t = achievementToast(longest);
    expect(t.duration).toBe(readingTime(ACHIEVEMENT_TOAST_TITLE, text(t.description)));
  });
});

describe('announcing a batch', () => {
  const batch = ACHIEVEMENTS.slice(0, 3);

  it('draws each with its badge, in the order they were earned', async () => {
    const toasts = await achievementToasts(batch);
    expect(toasts.map((t) => text(t.description))).toEqual(batch.map((a) => `${a.name} — +${a.reward.toLocaleString()} coins`));
    expect(toasts.every((t) => html(t.icon).includes('<svg'))).toBe(true);
  });

  // The drawn toast is a chunk of its own, fetched with the first unlock. If
  // it cannot arrive, the player is still told, in the same words.
  it('still says it, without the drawing, when that chunk cannot load', async () => {
    const toasts = await achievementToasts(batch, () => Promise.reject(new Error('offline')));
    expect(toasts).toEqual(batch.map(plainAchievementToast));
    for (const [i, t] of toasts.entries()) {
      expect(t.title).toBe(ACHIEVEMENT_TOAST_TITLE);
      expect(t.description).toBe(`${batch[i].name} — +${batch[i].reward.toLocaleString()} coins`);
      expect(t.description).not.toMatch(EMOJI);
    }
  });

  it('survives a loader that throws rather than rejects', async () => {
    const toasts = await achievementToasts(batch, () => { throw new Error('boom'); });
    expect(toasts).toHaveLength(3);
  });
});
