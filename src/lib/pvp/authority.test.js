import { describe, expect, it } from 'vitest';
import { createMatch, replay, stateHash } from '../combat/engine.js';
import { acceptAction, freshMatch } from './authority.js';
import { ratingWindow, ratingsMatch } from './timing.js';

const bear = (id) => ({
  id, name: `B${id}`, attack: 2, defense: 2, type: 'action', cost: 1, ability: 'none',
});
const deck = (id) => Array.from({ length: 10 }, () => bear(id));

function started(now = 1_000_000) {
  const state = createMatch({
    seed: 4, deckA: deck(1), deckB: deck(2), nameA: 'Ada', nameB: 'Bea', first: 'a',
  });
  let match = freshMatch(state, now);
  const a = acceptAction(match, {
    id: 'mull-a', seat: 'a', turn: 0, version: state.version, intent: { type: 'mulligan', toss: [] },
  }, now);
  match = a.match;
  const b = acceptAction(match, {
    id: 'mull-b', seat: 'b', turn: 0, version: match.state.version, intent: { type: 'mulligan', toss: [] },
  }, now);
  return b.match;
}

describe('pub brawl admission', () => {
  it('widens the matchmaking window and then stops', () => {
    expect(ratingWindow(0)).toBe(50);
    expect(ratingWindow(4999)).toBe(50);
    expect(ratingWindow(5000)).toBe(100);
    expect(ratingWindow(20_000)).toBe(250);
    expect(ratingWindow(10_000_000)).toBe(400);
    expect(ratingsMatch(1000, 1240, 20_000)).toBe(true);
    expect(ratingsMatch(1000, 1260, 20_000)).toBe(false);
  });

  it('rejects an illegal move and an out-of-turn move without moving the version', () => {
    const now = 5_000;
    const match = started(now);
    const version = match.state.version;
    const hash = stateHash(match.state);
    const illegal = acceptAction(match, {
      id: 'nope', seat: 'a', turn: match.state.turnNumber, version,
      intent: { type: 'attack', attackerId: 'missing', targetId: 'face' },
    }, now);
    expect(illegal.ok).toBe(false);
    expect(illegal.error).toBe('bad_card');
    const late = acceptAction(match, {
      id: 'not-you', seat: 'b', turn: match.state.turnNumber, version,
      intent: { type: 'end' },
    }, now);
    expect(late.ok).toBe(false);
    expect(late.error).toBe('out_of_turn');
    expect(stateHash(match.state)).toBe(hash);
  });

  it('treats a repeated action id as the same move', () => {
    const now = 5_000;
    const match = started(now);
    const action = {
      id: 'end-1', seat: 'a', turn: match.state.turnNumber, version: match.state.version,
      intent: { type: 'end' },
    };
    const first = acceptAction(match, action, now);
    expect(first.ok).toBe(true);
    const again = acceptAction(first.match, action, now + 10);
    expect(again.ok).toBe(true);
    expect(again.idempotent).toBe(true);
    expect(again.match.state.version).toBe(first.match.state.version);
    expect(stateHash(again.match.state)).toBe(stateHash(first.match.state));
  });

  it('rejects a stale version and still replays the stored actions onto the same hash', () => {
    const now = 5_000;
    const match = started(now);
    const stale = acceptAction(match, {
      id: 'old', seat: 'a', turn: match.state.turnNumber, version: match.state.version - 1,
      intent: { type: 'end' },
    }, now);
    expect(stale.ok).toBe(false);
    expect(stale.error).toBe('stale');
    const ended = acceptAction(match, {
      id: 'end-1', seat: 'a', turn: match.state.turnNumber, version: match.state.version,
      intent: { type: 'end' },
    }, now);
    const setup = {
      seed: 4, deckA: deck(1), deckB: deck(2), nameA: 'Ada', nameB: 'Bea', first: 'a',
    };
    const played = replay(setup, [
      { seat: 'a', intent: { type: 'mulligan', toss: [] } },
      { seat: 'b', intent: { type: 'mulligan', toss: [] } },
      { seat: 'a', intent: { type: 'end' } },
    ]);
    expect(played.ok).toBe(true);
    expect(played.hash).toBe(stateHash(ended.match.state));
  });

  it('ends a silent turn on the server clock and extends it once when they drop', () => {
    const now = 10_000;
    const match = started(now);
    const early = acceptAction(match, {
      id: 'hb', seat: 'a', turn: match.state.turnNumber, version: match.state.version,
      intent: { type: 'heartbeat' },
    }, now + 1000);
    expect(early.ok).toBe(true);
    expect(early.match.state.phase).toBe('main');
    const dropped = { ...match, seen: { a: now - 30_000, b: now } };
    const held = acceptAction(dropped, {
      id: 'hb2', seat: 'b', turn: match.state.turnNumber, version: match.state.version,
      intent: { type: 'heartbeat' },
    }, now + 1000);
    expect(held.ok).toBe(true);
    expect(held.match.graceUsed).toBe(true);
    expect(held.match.deadline).toBeGreaterThan(match.deadline);
    const clock = match.deadline + 1;
    const burned = acceptAction(match, {
      id: 'late', seat: 'a', turn: match.state.turnNumber, version: match.state.version,
      intent: { type: 'end' },
    }, clock);
    expect(burned.ok).toBe(true);
    expect(burned.timedOut).toBe(true);
    expect(burned.match.state.reason).toBe('timeout');
    expect(burned.match.state.winner).toBe('b');
  });
});
