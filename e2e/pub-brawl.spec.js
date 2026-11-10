// Two browsers, one mocked bar. The mock runs the real engine in this process.
// CI has no local Supabase; the edge-function tests cover admission, and this
// drives the screens a pair of players actually touch.
import { expect, test, REF, stubSupabase, seedSignedIn } from './helpers/session.js';
import { DOOR_KEY, doorRecord } from '../src/lib/door.js';
import { CONSENT_KEY, consentRecord } from '../src/lib/consent.js';
import { createMatch, projectFor, replay, stateHash } from '../src/lib/combat/engine.js';
import { acceptAction, freshMatch } from '../src/lib/pvp/authority.js';
import { cardsFor } from '../src/lib/pvp/decks.js';

const A = '11111111-1111-4111-8111-111111111111';
const B = '22222222-2222-4222-8222-222222222222';

function tokenFor(id) {
  const b64 = (obj) => Buffer.from(JSON.stringify(obj)).toString('base64url');
  return [
    b64({ alg: 'HS256', typ: 'JWT' }),
    b64({ sub: id, role: 'authenticated', exp: 4102444800 }),
    'sig',
  ].join('.');
}

function sessionFor(id, email) {
  return {
    access_token: tokenFor(id),
    token_type: 'bearer',
    expires_in: 3600 * 24 * 365,
    expires_at: 4102444800,
    refresh_token: 'fake-refresh',
    user: {
      id, aud: 'authenticated', role: 'authenticated', email,
      email_confirmed_at: '2026-01-01T00:00:00Z',
      app_metadata: { provider: 'email' }, user_metadata: {},
      created_at: '2026-01-01T00:00:00Z',
    },
  };
}

function room() {
  const queue = [];
  let match = null;
  const views = {};
  const publish = (state, deadline) => {
    for (const seat of ['a', 'b']) {
      const player = match.players.find((p) => p.seat === seat);
      views[player.id] = {
        ...projectFor(state, seat),
        matchId: match.id,
        kind: 'ladder',
        night: null,
        deadline: new Date(deadline).toISOString(),
        servedAt: Date.now(),
        yourDelta: state.phase === 'over' ? (state.winner === seat ? 12 : -12) : null,
      };
    }
  };
  const open = (a, b) => {
    const deckA = cardsFor(a.deck);
    const deckB = cardsFor(b.deck);
    const setup = {
      seed: 9, deckA, deckB, nameA: 'QA Bear', nameB: 'Rival Bear', rules: { id: 'standard', hp: 0, energy: 0, damage: 0 }, first: 'a',
    };
    const state = createMatch(setup);
    const now = Date.now();
    match = {
      id: '33333333-3333-4333-8333-333333333333',
      players: [{ id: a.user, seat: 'a' }, { id: b.user, seat: 'b' }],
      live: freshMatch(state, now, { mulliganMs: 60_000, turnMs: 60_000 }),
      setup,
      actions: [],
    };
    publish(state, match.live.deadline);
  };
  return {
    handle(user, name, body) {
      if (name === 'pvp-queue' && body.op === 'join') {
        if (!queue.find((row) => row.user === user)) queue.push({ user, deck: body.deck });
        if (!match && queue.length >= 2) open(queue[0], queue[1]);
        if (match) return { ok: true, view: views[user], matchId: match.id };
        return { ok: true, status: 'waiting', offerGhost: false, rating: 1000, enqueued_at: new Date().toISOString() };
      }
      if (name === 'pvp-queue') {
        if (match) return { ok: true, view: views[user], matchId: match.id, status: 'active' };
        return { ok: true, status: queue.find((row) => row.user === user) ? 'waiting' : 'empty', offerGhost: false };
      }
      if (!match) return { ok: false, error: 'missing' };
      const seat = match.players.find((p) => p.id === user)?.seat;
      if (body.op === 'sync') return { ok: true, view: views[user], matchId: match.id };
      const admitted = acceptAction(match.live, {
        id: body.actionId, seat, turn: body.turn, version: body.version, intent: body.intent,
      }, Date.now(), { turnMs: 60_000, mulliganMs: 60_000 });
      if (!admitted.ok) return admitted;
      match.live = admitted.match;
      if (!admitted.idempotent && !admitted.heartbeat) {
        match.actions.push({ seat, intent: body.intent, server: body.intent?.type === 'timeout' });
      }
      publish(match.live.state, match.live.deadline);
      return { ok: true, view: views[user], matchId: match.id, hash: stateHash(match.live.state) };
    },
    snapshot() {
      return match;
    },
  };
}

async function boot(page, id, bar) {
  const session = sessionFor(id, `${id.slice(0, 8)}@example.com`);
  await stubSupabase(page);
  await page.route('**/functions/v1/pvp-*', async (route) => {
    const url = route.request().url();
    const name = url.split('/functions/v1/')[1].split('?')[0];
    const body = route.request().postDataJSON() || {};
    await route.fulfill({ json: bar.handle(id, name, body) });
  });
  await seedSignedIn(page);
  await page.addInitScript(([key, value]) => {
    localStorage.setItem(key, JSON.stringify(value));
  }, [`sb-${REF}-auth-token`, session]);
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Battle', exact: true })).toBeVisible();
}

test('two players finish a pub brawl', async ({ browser }) => {
  test.setTimeout(90_000);
  const bar = room();
  const wire = async (context, id) => {
    await context.addInitScript(([door, doorValue, consent, consentValue]) => {
      localStorage.setItem(door, doorValue);
      localStorage.setItem(consent, consentValue);
    }, [DOOR_KEY, doorRecord('pass', 0), CONSENT_KEY, consentRecord('granted', 0)]);
    const page = await context.newPage();
    await boot(page, id, bar);
    return page;
  };

  const left = await browser.newContext();
  const right = await browser.newContext();
  const ada = await wire(left, A);
  const bea = await wire(right, B);

  await ada.getByRole('button', { name: 'Pub Brawl' }).click();
  await bea.getByRole('button', { name: 'Pub Brawl' }).click();
  await ada.getByRole('button', { name: 'Take a stool' }).click();
  await bea.getByRole('button', { name: 'Take a stool' }).click();

  const act = async (page) => {
    const over = page.getByRole('heading', { name: /drank them under the table|You are under it/ });
    if (await over.count() && await over.first().isVisible().catch(() => false)) return 'over';
    const keep = page.getByRole('button', { name: 'Keep the hand' });
    if (await keep.isVisible().catch(() => false)) {
      await keep.click();
      return 'keep';
    }
    const face = page.getByRole('button', { name: 'Hit their face' });
    if (await face.isVisible().catch(() => false)) {
      await face.click();
      return 'face';
    }
    const swing = page.locator('[data-turn="yours"] button').filter({ hasText: /\// }).first();
    if (await swing.isVisible().catch(() => false)) {
      await swing.click();
      return 'aim';
    }
    const play = page.getByRole('button', { name: /^Play / }).first();
    if (await play.isVisible().catch(() => false)) {
      await play.click();
      return 'play';
    }
    const end = page.getByRole('button', { name: 'End turn' });
    if (await end.isVisible().catch(() => false)) {
      await end.click();
      return 'end';
    }
    return 'wait';
  };

  let finished = false;
  for (let i = 0; i < 40 && !finished; i += 1) {
    const a = await act(ada);
    const b = await act(bea);
    finished = a === 'over' || b === 'over';
    if (a === 'wait' && b === 'wait') await ada.waitForTimeout(400);
  }
  if (!finished) {
    const forfeiter = ada.getByRole('button', { name: 'Forfeit' });
    if (await forfeiter.isVisible().catch(() => false)) await forfeiter.click();
  }
  await expect(ada.getByRole('heading', { name: /drank them under the table|You are under it/ })).toBeVisible({ timeout: 15_000 });
  await expect(bea.getByRole('heading', { name: /drank them under the table|You are under it/ })).toBeVisible({ timeout: 15_000 });
  const finishedMatch = bar.snapshot();
  const played = replay(finishedMatch.setup, finishedMatch.actions);
  expect(played.ok, played.error).toBe(true);
  expect(played.hash).toBe(stateHash(finishedMatch.live.state));
  await left.close();
  await right.close();
});
