import { afterEach, describe, expect, it } from 'vitest';
import {
  DISCORD_SCOPES, LIVE_SEAM, X_SCOPES,
  applyFriendAction, canSeePresence, challengePlan, cleanGuildIds, cleanInvite,
  enabledPlatforms, friendCodeFromHref, friendInviteUrl, guildIdsFromPayload,
  presenceForScreen, presenceHidden, rankSearch, readPresence, setPresenceHidden,
  suggestFriends, xIntentUrl,
} from './friends.js';

afterEach(() => setPresenceHidden(false));

describe('friend and suggestion rules', () => {
  it('keeps only discord snowflakes, and drops names from a guild payload', () => {
    expect(cleanGuildIds(['1', '12345678901234567', '12345678901234567', 'nope'])).toEqual([
      '12345678901234567',
    ]);
    expect(guildIdsFromPayload([
      { id: '12345678901234567', name: 'The Back Room' },
      { id: 'nope', name: 'Nope' },
    ])).toEqual(['12345678901234567']);
    expect(JSON.stringify(guildIdsFromPayload([{ id: '12345678901234567', name: 'Secret' }]))).not.toMatch(/Secret/);
  });

  it('suggests linked players who share a server, most overlap first, and skips pals and blocks', () => {
    const people = suggestFriends({
      selfId: 'me',
      mine: ['h1', 'h2'],
      friendIds: ['pal'],
      blockedIds: ['nope'],
      people: [
        { id: 'me', name: 'Me', linkedDiscord: true, guilds: ['h1'] },
        { id: 'pal', name: 'Pal', linkedDiscord: true, guilds: ['h1', 'h2'] },
        { id: 'nope', name: 'Nope', linkedDiscord: true, guilds: ['h1', 'h2'] },
        { id: 'one', name: 'One', linkedDiscord: true, guilds: ['h1'] },
        { id: 'two', name: 'Two', linkedDiscord: true, guilds: ['h1', 'h2', 'h1'] },
        { id: 'stranger', name: 'Stranger', linkedDiscord: true, guilds: ['h9'] },
        { id: 'unlinked', name: 'Unlinked', linkedDiscord: false, guilds: ['h1'] },
      ],
    });
    expect(people.map((row) => row.id)).toEqual(['two', 'one']);
    expect(people[0].shared).toBe(2);
  });

  it('ranks an in-game name ahead of a Discord handle', () => {
    const rows = rankSearch('bea', [
      { username: 'Beatrice', discord_name: 'bea' },
      { username: 'Bea', discord_name: 'other' },
      { username: 'Someone', discord_name: 'beatrice' },
    ]);
    expect(rows.map((row) => row.username)).toEqual(['Bea', 'Beatrice', 'Someone']);
  });

  it('moves a request the way the server does, and a block ends it', () => {
    expect(applyFriendAction('none', 'request').status).toBe('out');
    expect(applyFriendAction('in', 'request').status).toBe('friends');
    expect(applyFriendAction('in', 'accept').status).toBe('friends');
    expect(applyFriendAction('in', 'decline').status).toBe('none');
    expect(applyFriendAction('friends', 'remove').status).toBe('none');
    expect(applyFriendAction('out', 'accept').refused).toBe(true);
    expect(applyFriendAction('friends', 'block').status).toBe('blocked');
    expect(applyFriendAction('blocked', 'request').refused).toBe(true);
    expect(applyFriendAction('blocked', 'unblock').status).toBe('none');
  });

  it('shows presence to friends only, and not to someone who stepped out or was blocked', () => {
    const base = { viewer: 'a', subject: 'b', friendIds: ['b'], blocks: [], offlineIds: [] };
    expect(canSeePresence(base)).toBe(true);
    expect(canSeePresence({ ...base, friendIds: [] })).toBe(false);
    expect(canSeePresence({ ...base, offlineIds: ['b'] })).toBe(false);
    expect(canSeePresence({ ...base, blocks: [['a', 'b']] })).toBe(false);
    expect(canSeePresence({ ...base, viewer: 'b', subject: 'b', offlineIds: ['b'] })).toBe(true);
    expect(canSeePresence({ ...base, viewer: '', subject: 'b' })).toBe(false);
  });

  it('deals a ghost brawl now and leaves live PvP a row to fulfill', () => {
    expect(challengePlan('ghost')).toEqual({ mode: 'ghost', playsNow: true, seam: 'ladder_matches' });
    expect(challengePlan('live')).toEqual({ mode: 'live', playsNow: false, seam: LIVE_SEAM });
    expect(challengePlan('ranked')).toBeNull();
  });

  it('hides link buttons until the provider is actually on', () => {
    expect(enabledPlatforms(null)).toEqual({ discord: false, x: false });
    expect(enabledPlatforms({ external: { discord: true } })).toEqual({ discord: true, x: false });
    expect(enabledPlatforms({ external: { twitter: true } }).x).toBe(true);
    expect(enabledPlatforms({ external: { x: true } }).x).toBe(true);
  });

  it('builds an invite and an X intent without asking X for followers', () => {
    const code = 'abcdef123456';
    expect(cleanInvite(`  ${code.toUpperCase()} `)).toBe(code);
    expect(friendCodeFromHref(`https://terribleteddies.vercel.app/?friend=${code}`)).toBe(code);
    expect(friendInviteUrl(code)).toBe(`https://terribleteddies.vercel.app/?friend=${code}`);
    const intent = xIntentUrl(friendInviteUrl(code));
    expect(intent.startsWith('https://x.com/intent/post?text=')).toBe(true);
    expect(decodeURIComponent(intent)).toMatch(/Slide into their DMs/);
    expect(decodeURIComponent(intent)).toContain(friendInviteUrl(code));
    expect(X_SCOPES).not.toMatch(/follows/);
    expect(DISCORD_SCOPES).toBe('identify guilds');
  });

  it('is at the bar, in a fight, or around, and quiet when appearing offline', () => {
    expect(presenceForScreen('menu', false)).toBe('bar');
    expect(presenceForScreen('deck', true)).toBe('bar');
    expect(presenceForScreen('game', false)).toBe('match');
    expect(presenceForScreen('deck', false)).toBe('online');
    setPresenceHidden(true);
    expect(presenceHidden()).toBe(true);
    expect(presenceForScreen('menu', false)).toBeNull();
  });

  it('reads the latest presence meta and drops anything else', () => {
    expect(readPresence({
      a: [{ status: 'online' }, { status: 'match' }],
      b: [{ status: 'asleep' }],
    })).toEqual({ a: 'match' });
  });
});
