import { describe, expect, it, vi } from 'vitest';
import webpush from 'web-push';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { deliverOutbox, outboxFromRequest } from './deliver.js';
import {
  FRIEND_ONLINE_DEBOUNCE_MS, PUSH_HOURLY_CAP, pushCopy, shouldEnqueue,
} from '../../../src/lib/push/policy.js';

const prefsOn = {
  enabled: true,
  friends_online: true,
  challenges: true,
  your_turn: true,
  quietEnabled: false,
  quietStart: 2,
  quietEnd: 8,
  tzOffsetMinutes: 0,
};

const sub = { endpoint: 'https://push.example/1', p256dh: 'p256dh-key', auth: 'auth-key' };

describe('a trigger decision reaches the push function', () => {
  it('sends a friend-online ping once, then the debounce holds the next one', async () => {
    const now = new Date('2026-11-10T18:00:00Z');
    const first = shouldEnqueue({
      kind: 'friends_online', prefs: prefsOn, now, sentThisHour: 0,
    });
    expect(first).toEqual({ inbox: true, web: true, reason: 'send' });
    const copy = pushCopy('friends_online', 'Bea');
    const send = vi.fn(() => Promise.resolve());
    const dropped = [];
    const result = await deliverOutbox({
      id: 'row-1', user_id: 'user-b', title: copy.title, body: copy.body, url: '/?social=room',
    }, {
      listSubscriptions: async () => [sub],
      send,
      dropSubscription: async (endpoint) => { dropped.push(endpoint); },
      markSent: async () => {},
    });
    expect(result.sent).toBe(1);
    expect(send).toHaveBeenCalledWith(
      { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
      JSON.stringify({ title: copy.title, body: copy.body, url: '/?social=room' }),
    );
    expect(dropped).toEqual([]);

    const again = shouldEnqueue({
      kind: 'friends_online',
      prefs: prefsOn,
      now: new Date(now.getTime() + 60 * 60 * 1000),
      lastAt: now.toISOString(),
      sentThisHour: 1,
    });
    expect(again.reason).toBe('debounce');
    expect(again.web).toBe(false);
    expect(again.inbox).toBe(false);
  });

  it('does not send when the player has not opted in, or that type is off', () => {
    expect(shouldEnqueue({ kind: 'challenge_live', prefs: { ...prefsOn, enabled: false } }).reason).toBe('off');
    expect(shouldEnqueue({
      kind: 'your_turn',
      prefs: { ...prefsOn, your_turn: false },
    }).reason).toBe('type');
    expect(shouldEnqueue({
      kind: 'accept_request',
      prefs: { ...prefsOn, challenges: false },
    }).inbox).toBe(false);
  });

  it('keeps the toast and skips the push during quiet hours and a focused turn', () => {
    const night = new Date('2026-11-10T04:30:00Z');
    const quiet = shouldEnqueue({
      kind: 'challenge_ghost',
      prefs: { ...prefsOn, quietEnabled: true, quietStart: 2, quietEnd: 8, tzOffsetMinutes: 0 },
      now: night,
    });
    expect(quiet).toEqual({ inbox: true, web: false, reason: 'quiet' });
    const focused = shouldEnqueue({
      kind: 'your_turn', prefs: prefsOn, focused: true, now: new Date('2026-11-10T18:00:00Z'),
    });
    expect(focused).toEqual({ inbox: true, web: false, reason: 'focused' });
  });

  it('stops after the hourly cap', () => {
    const capped = shouldEnqueue({
      kind: 'challenge_live', prefs: prefsOn, sentThisHour: PUSH_HOURLY_CAP,
    });
    expect(capped.reason).toBe('rate');
    expect(capped.inbox).toBe(false);
  });

  it('deletes a subscription the push service says is gone', async () => {
    const dropped = [];
    const gone = new Error('gone');
    gone.statusCode = 410;
    const missing = new Error('missing');
    missing.statusCode = 404;
    const send = vi.fn()
      .mockRejectedValueOnce(gone)
      .mockRejectedValueOnce(missing);
    const result = await deliverOutbox({
      id: 'row-2', user_id: 'user-b', title: 'Your turn', body: pushCopy('your_turn').body,
    }, {
      listSubscriptions: async () => [
        { endpoint: 'https://push.example/old', p256dh: 'a', auth: 'b' },
        { endpoint: 'https://push.example/older', p256dh: 'c', auth: 'd' },
      ],
      send,
      dropSubscription: async (endpoint) => { dropped.push(endpoint); },
      markSent: async () => {},
    });
    expect(result).toEqual({ sent: 0, dropped: 2 });
    expect(dropped).toEqual(['https://push.example/old', 'https://push.example/older']);
  });

  it('reads a webhook body and refuses to invent a row', () => {
    expect(outboxFromRequest({
      type: 'INSERT',
      record: { id: '1', user_id: 'u', title: 'Your turn', body: 'hi' },
    }).id).toBe('1');
    expect(outboxFromRequest({ hello: true })).toBeNull();
  });

  it('generates a VAPID pair in memory and does not write it down', () => {
    const keys = webpush.generateVAPIDKeys();
    expect(keys.publicKey.length).toBeGreaterThan(20);
    expect(keys.privateKey.length).toBeGreaterThan(20);
    const tree = readFileSync(resolve(process.cwd(), 'docs/PUSH_SETUP.md'), 'utf8');
    expect(tree).not.toContain(keys.privateKey);
    expect(tree).toContain('npx web-push generate-vapid-keys');
  });

  it('uses the same debounce the migration names', () => {
    expect(FRIEND_ONLINE_DEBOUNCE_MS).toBe(4 * 60 * 60 * 1000);
    const sql = readFileSync(
      resolve(process.cwd(), 'supabase/migrations/20261110170000_push_notifications.sql'),
      'utf8',
    );
    expect(sql).toContain("INTERVAL '4 hours'");
    expect(sql).toContain('v_sent >= 10');
    expect(sql).toContain("Your turn, darling. Don''t keep them waiting.");
    expect(sql).toContain('push_your_turn');
  });
});
