// The one combat engine. The Pub Brawl board imports it for what a move is
// allowed to be. The edge function imports it and is the only thing that
// applies a move. Ghost brawls keep the single-player board; the hit, the
// cost and the keywords underneath both are these same functions.
//
// Pure. No clock, no Math.random, no gems. A gems field on a card or a seat
// is ignored. House-rule modifiers that are symmetric (health, energy, the
// extra point of damage) apply. Boss night does not: it exists to mend one
// AI, and a live match has two players.

import {
  MAX_ENERGY, MAX_FIELD_SIZE, MAX_HAND_SIZE, MOMENTUM_MAX, energyForTurn,
} from '../../components/GameBoard/turn.js';
import {
  canAttack, canSwingFace, effectiveAttack, effectiveCost, getValidTargets,
  pickBlackoutTarget, rallyField, readyCreatures, resolveCreatureHit, stampSwing,
} from '../../utils/battleUtils.js';
import { PLAYER_MAX_HEALTH, TRAP_DEFAULT_DAMAGE } from '../effects.js';
import { fatigueForEmptyDraw } from '../fatigue.js';
import { energyAfterCut, commitBarSpecial, payTab } from '../barService.js';
import { applyMulligan } from '../mulligan.js';
import { pickMvp } from '../matchNight.js';
import { hashString, nextRandom } from './rng.js';

const OTHER = { a: 'b', b: 'a' };

/** The fields a fight actually reads. Flavor, art and rarity never enter. */
export function combatCard(card, instanceId) {
  return {
    instanceId,
    id: card.id,
    name: card.name,
    attack: card.attack || 0,
    defense: card.defense || 0,
    currentHp: card.currentHp ?? card.defense ?? 0,
    type: card.type,
    cost: card.cost || 0,
    ability: card.ability && card.ability !== 'none' ? card.ability : 'none',
    effect: card.effect || null,
    amount: card.amount || 0,
    tribe: card.tribe || null,
  };
}

function shuffle(cards, rng) {
  const next = cards.slice();
  let state = rng >>> 0;
  for (let i = next.length - 1; i > 0; i -= 1) {
    const roll = nextRandom(state);
    state = roll.state;
    const j = Math.floor(roll.value * (i + 1));
    const swap = next[i];
    next[i] = next[j];
    next[j] = swap;
  }
  return { cards: next, rng: state };
}

function roll(state) {
  const rolled = nextRandom(state.rng);
  state.rng = rolled.state;
  return rolled.value;
}

/** Symmetric house rules. Boss night is folded back to the house. */
export function pvpRules(rule) {
  const id = rule && rule.id && rule.id !== 'boss' ? rule.id : 'standard';
  const source = rule && rule.id !== 'boss' ? rule : {};
  return {
    id,
    hp: source.hp || 0,
    energy: source.energy || 0,
    damage: source.damage || 0,
  };
}

function emptySeat(name, maxHealth) {
  return {
    name: name || 'A rival',
    health: maxHealth,
    maxHealth,
    energy: 0,
    momentum: 0,
    fatigue: 0,
    hand: [],
    deck: [],
    field: [],
    taunt: null,
    stats: { damage: 0, healing: 0, cards: 0 },
  };
}

function pushLog(state, line) {
  state.log = [...state.log, line].slice(-24);
}

function noteMvp(state, card, damage) {
  if (!card || !damage) return;
  const prev = state.mvp[card.instanceId] || { id: card.instanceId, name: card.name, damage: 0 };
  state.mvp = {
    ...state.mvp,
    [card.instanceId]: { ...prev, name: card.name, damage: prev.damage + damage },
  };
}

function stampDeck(cards, seat, start) {
  let n = start;
  const stamped = [];
  for (let i = 0; i < cards.length; i += 1) {
    n += 1;
    stamped.push(combatCard(cards[i], `${seat}-${n}`));
  }
  return { stamped, next: n };
}

/** Bump when a replay from an older ruleset would not reconstruct. */
export const ENGINE_VERSION = 1;

/**
 * Deal a match. `deckA` / `deckB` are card records (already looked up).
 * `seed` is a uint32. `first` is who sits down on turn 1.
 * `preserveOrder` keeps the deck order it was given (a house fight already shuffled).
 */
export function createMatch({ seed, deckA, deckB, nameA, nameB, rules, first, preserveOrder = false }) {
  const rule = pvpRules(rules);
  const maxHealth = Math.max(1, PLAYER_MAX_HEALTH + rule.hp);
  const seeded = (Number(seed) >>> 0) || 1;
  const aStamped = stampDeck(deckA || [], 'a', 0);
  const bStamped = stampDeck(deckB || [], 'b', 0);
  const shuffledA = preserveOrder
    ? { cards: aStamped.stamped, rng: seeded }
    : shuffle(aStamped.stamped, seeded);
  const shuffledB = preserveOrder
    ? { cards: bStamped.stamped, rng: shuffledA.rng }
    : shuffle(bStamped.stamped, shuffledA.rng);
  const seats = {
    a: emptySeat(nameA, maxHealth),
    b: emptySeat(nameB, maxHealth),
  };
  seats.a.hand = shuffledA.cards.slice(0, 5);
  seats.a.deck = shuffledA.cards.slice(5);
  seats.b.hand = shuffledB.cards.slice(0, 5);
  seats.b.deck = shuffledB.cards.slice(5);
  const starter = first === 'b' ? 'b' : 'a';
  return {
    rng: shuffledB.rng,
    phase: 'mulligan',
    turn: null,
    turnNumber: 0,
    version: 1,
    first: starter,
    winner: null,
    reason: null,
    rules: rule,
    log: ['Both of you look at five. Throw any back, or keep them.'],
    mvp: {},
    mulligan: { a: false, b: false },
    seats,
  };
}

function beginTurn(state, seat) {
  state.turn = seat;
  state.turnNumber += 1;
  state.phase = 'main';
  const side = state.seats[seat];
  const owed = payTab(side.health, side.tab || 0);
  side.tab = 0;
  if (owed.paid) {
    side.health = owed.health;
    pushLog(state, `${side.name} pays the tab. −${owed.paid}.`);
    if (side.health <= 0) {
      state.phase = 'over';
      state.turn = null;
      state.winner = OTHER[seat];
      state.reason = 'hp';
      pushLog(state, `${side.name} is done. The tab won.`);
      return;
    }
  }
  side.field = side.field.map((card) => ({ ...card, stealthActive: false }));
  side.energy = energyAfterCut(
    Math.min(MAX_ENERGY, energyForTurn(state.turnNumber) + (state.rules.energy || 0)),
    side.cut || 0,
  );
  side.cut = 0;
  if (side.deck.length === 0) {
    const amount = fatigueForEmptyDraw(side.fatigue);
    side.fatigue = amount;
    const dealt = Math.min(side.health, amount);
    side.health -= dealt;
    side.stats.damage += 0;
    pushLog(state, `${side.name} draws air. Fatigue ${amount}.`);
    if (side.health <= 0) {
      state.phase = 'over';
      state.turn = null;
      state.winner = OTHER[seat];
      state.reason = 'fatigue';
      pushLog(state, `${side.name} is done. The keg won.`);
      return;
    }
  } else if (side.hand.length >= MAX_HAND_SIZE) {
    pushLog(state, `${side.name}'s hand is full. The draw stays in the deck.`);
  } else {
    const [drawn, ...rest] = side.deck;
    side.deck = rest;
    side.hand = [...side.hand, drawn];
    pushLog(state, `${side.name} draws.`);
  }
  pushLog(state, `${side.name}'s turn.`);
}

function bothReady(state) {
  return state.mulligan.a && state.mulligan.b;
}

function maybeStart(state) {
  if (state.phase === 'mulligan' && bothReady(state)) beginTurn(state, state.first);
}

function findCard(list, instanceId) {
  return list.find((card) => card.instanceId === instanceId) || null;
}

function killCheck(state, killer) {
  const deadA = state.seats.a.health <= 0;
  const deadB = state.seats.b.health <= 0;
  if (!deadA && !deadB) return;
  state.phase = 'over';
  state.turn = null;
  if (deadA && deadB) state.winner = killer;
  else state.winner = deadA ? 'b' : 'a';
  state.reason = state.reason || 'hp';
  const name = state.seats[state.winner].name;
  pushLog(state, `${name} is the one still sitting up.`);
}

function spendAttacker(field, instanceId) {
  return field.map((card) => (card.instanceId === instanceId ? stampSwing(card) : card));
}

function hitCreature(state, seat, attacker, targetId) {
  const foe = OTHER[seat];
  const me = state.seats[seat];
  const them = state.seats[foe];
  const valid = getValidTargets(me.field, them.field);
  let target = findCard(valid, targetId);
  if (attacker.ability === 'blackout') {
    target = valid.length ? pickBlackoutTarget(valid, () => roll(state)) : null;
  }
  if (!target) return { ok: false, error: 'blocked' };
  const hit = resolveCreatureHit(attacker, target, me.field, state.rules.damage || 0, { health: me.health });
  me.stats.damage += hit.dmg;
  noteMvp(state, attacker, hit.dmg);
  me.momentum = Math.min(MOMENTUM_MAX, me.momentum + 2);
  me.field = spendAttacker(me.field, attacker.instanceId);
  if (hit.survivor) {
    them.field = them.field.map((card) => (
      card.instanceId === target.instanceId ? hit.survivor : card
    ));
    pushLog(state, `${attacker.name} hits ${target.name} for ${hit.dmg}. ${hit.survivor.currentHp} left.`);
  } else {
    them.field = them.field.filter((card) => card.instanceId !== target.instanceId);
    const spill = hit.overkill || 0;
    if (spill > 0) them.health = Math.max(0, them.health - spill);
    pushLog(state, `${attacker.name} unstuffs ${target.name}.${spill ? ` ${spill} reaches the face.` : ''}`);
    killCheck(state, seat);
  }
  return { ok: true };
}

function hitFace(state, seat, attacker) {
  const foe = OTHER[seat];
  const me = state.seats[seat];
  const them = state.seats[foe];
  const valid = getValidTargets(me.field, them.field);
  if (valid.length > 0) return { ok: false, error: 'blocked' };
  if (!canSwingFace(attacker)) return { ok: false, error: 'rush' };
  const trap = them.field.find((card) => card.type === 'trap');
  me.field = spendAttacker(me.field, attacker.instanceId);
  me.momentum = Math.min(MOMENTUM_MAX, me.momentum + 3);
  if (trap) {
    const amount = trap.amount || TRAP_DEFAULT_DAMAGE;
    const dealt = Math.min(me.health, amount);
    them.field = them.field.filter((card) => card.instanceId !== trap.instanceId);
    me.health -= dealt;
    them.stats.damage += dealt;
    pushLog(state, `${trap.name} springs. ${dealt} into ${me.name}.`);
    killCheck(state, foe);
    return { ok: true };
  }
  const damage = effectiveAttack(attacker, me.field, { health: me.health }) + (state.rules.damage || 0);
  const dealt = Math.max(0, damage);
  them.health = Math.max(0, them.health - dealt);
  me.stats.damage += dealt;
  noteMvp(state, attacker, dealt);
  pushLog(state, `${attacker.name} hits ${them.name} for ${dealt}.`);
  killCheck(state, seat);
  return { ok: true };
}

function playCard(state, seat, instanceId) {
  const side = state.seats[seat];
  const card = findCard(side.hand, instanceId);
  if (!card) return { ok: false, error: 'bad_card' };
  const cost = effectiveCost(card, side.field);
  if (side.energy < cost) return { ok: false, error: 'no_energy' };
  if (card.type !== 'special' && side.field.length >= MAX_FIELD_SIZE) return { ok: false, error: 'full' };
  side.energy -= cost;
  side.hand = side.hand.filter((held) => held.instanceId !== instanceId);
  side.stats.cards += 1;
  side.momentum = Math.min(MOMENTUM_MAX, side.momentum + 1);
  if (card.type === 'special') {
    applySpecial(state, seat, card);
    return { ok: true };
  }
  const played = {
    ...card,
    currentHp: card.defense,
    ...(card.type === 'action' ? { summoningSick: true } : {}),
    ...(card.ability === 'stealth' ? { stealthActive: true } : {}),
  };
  side.field = [...side.field, played];
  const tag = card.ability && card.ability !== 'none' ? ` (${card.ability})` : '';
  pushLog(state, `${side.name} plays ${card.name}${tag}.`);
  return { ok: true };
}

function applySpecial(state, seat, card) {
  const side = state.seats[seat];
  const bar = commitBarSpecial({
    health: side.health,
    maxHealth: side.maxHealth,
    field: side.field,
    deck: side.deck,
    hand: side.hand,
    handRoom: Math.max(0, MAX_HAND_SIZE - side.hand.length),
  }, card);
  if (bar) {
    side.health = bar.health;
    side.stats.healing += bar.healed || 0;
    if (bar.field) side.field = bar.field;
    if (bar.hand) side.hand = bar.hand;
    if (bar.deck) side.deck = bar.deck;
    if (bar.energyCut) {
      const foe = state.seats[OTHER[seat]];
      foe.cut = (foe.cut || 0) + bar.energyCut;
    }
    if (bar.due) side.tab = (side.tab || 0) + bar.due;
    pushLog(state, bar.log);
    return;
  }
  if (card.effect === 'heal') {
    const room = Math.max(0, side.maxHealth - side.health);
    const healed = Math.min(room, card.amount || 0);
    side.health += healed;
    side.stats.healing += healed;
    pushLog(state, healed
      ? `${card.name} puts ${healed} back.`
      : `${card.name} does nothing. Already full.`);
    return;
  }
  if (card.effect === 'draw') {
    const room = Math.max(0, MAX_HAND_SIZE - side.hand.length);
    const n = Math.min(card.amount || 0, side.deck.length, room);
    side.hand = [...side.hand, ...side.deck.slice(0, n)];
    side.deck = side.deck.slice(n);
    pushLog(state, n ? `${card.name} draws ${n}.` : `${card.name} draws nothing.`);
    return;
  }
  if (card.effect === 'buff') {
    const amount = card.amount || 0;
    let any = false;
    side.field = side.field.map((on) => {
      if (on.type !== 'action') return on;
      any = true;
      return { ...on, attack: on.attack + amount };
    });
    pushLog(state, any
      ? `${card.name} pumps the table by ${amount}.`
      : `${card.name} has nobody to pump.`);
    return;
  }
  pushLog(state, `${card.name} does nothing the bar recognises.`);
}

function endTurn(state, seat) {
  const side = state.seats[seat];
  side.field = readyCreatures(side.field);
  if (state.phase === 'over') return;
  beginTurn(state, OTHER[seat]);
}

function doMulligan(state, seat, toss) {
  if (state.mulligan[seat]) return { ok: false, error: 'illegal' };
  const ids = Array.isArray(toss) ? toss : [];
  const side = state.seats[seat];
  for (let i = 0; i < ids.length; i += 1) {
    if (!findCard(side.hand, ids[i])) return { ok: false, error: 'bad_card' };
  }
  const tossed = new Set(ids);
  const dealt = applyMulligan(side.hand, side.deck, tossed, () => roll(state));
  side.hand = dealt.hand;
  side.deck = dealt.deck;
  state.mulligan[seat] = true;
  pushLog(state, dealt.drawn ? `${side.name} throws ${dealt.drawn} back.` : `${side.name} keeps the hand.`);
  maybeStart(state);
  return { ok: true };
}

function fail(error) {
  return { ok: false, error, state: null, turnStarted: false, over: false };
}

/**
 * Apply one intent. Does not mutate `state`. `seat` is 'a' or 'b'.
 * Timeout is not a player intent; the server passes it with `server: true`.
 */
export function applyIntent(state, { seat, intent, server = false } = {}) {
  if (!state || state.phase === 'over') return fail('closed');
  if (!intent || typeof intent.type !== 'string') return fail('illegal');
  if (seat !== 'a' && seat !== 'b') return fail('illegal');
  const type = intent.type;
  if (type === 'timeout' && !server) return fail('illegal');
  if (type === 'emote') {
    const id = Number(intent.tauntId);
    if (!Number.isInteger(id) || id < 1 || id > 8) return fail('illegal');
    const next = JSON.parse(JSON.stringify(state));
    next.seats[seat].taunt = id;
    next.version += 1;
    pushLog(next, `${next.seats[seat].name} says something they will not repeat in daylight.`);
    return { ok: true, state: next, turnStarted: false, over: false };
  }
  if (type === 'forfeit') {
    const next = JSON.parse(JSON.stringify(state));
    next.phase = 'over';
    next.turn = null;
    next.winner = OTHER[seat];
    next.reason = 'forfeit';
    next.version += 1;
    pushLog(next, `${next.seats[seat].name} leaves the stool. That is a loss.`);
    return { ok: true, state: next, turnStarted: false, over: true };
  }

  const next = JSON.parse(JSON.stringify(state));
  let result;
  if (type === 'timeout' && next.phase === 'mulligan') {
    for (const side of ['a', 'b']) {
      if (!next.mulligan[side]) {
        const kept = doMulligan(next, side, []);
        if (!kept.ok) return fail(kept.error);
      }
    }
    result = { ok: true };
  } else if (type === 'timeout') {
    if (next.turn !== seat) return fail('out_of_turn');
    next.phase = 'over';
    next.turn = null;
    next.winner = OTHER[seat];
    next.reason = 'timeout';
    pushLog(next, `${next.seats[seat].name} let the clock run out.`);
    result = { ok: true };
  } else if (next.phase === 'mulligan') {
    if (type !== 'mulligan') return fail('out_of_turn');
    result = doMulligan(next, seat, intent.toss);
  } else if (next.turn !== seat) {
    return fail('out_of_turn');
  } else if (type === 'mulligan') {
    return fail('illegal');
  } else if (type === 'end') {
    endTurn(next, seat);
    result = { ok: true };
  } else if (type === 'rally') {
    const side = next.seats[seat];
    if (side.momentum < MOMENTUM_MAX || !side.field.some((card) => card.type === 'action')) {
      return fail('illegal');
    }
    side.field = rallyField(side.field);
    side.momentum = 0;
    pushLog(next, `${side.name} rallies. The table stands back up.`);
    result = { ok: true };
  } else if (type === 'play') {
    result = playCard(next, seat, intent.instanceId);
  } else if (type === 'attack') {
    const side = next.seats[seat];
    const attacker = findCard(side.field, intent.attackerId);
    if (!attacker || attacker.type !== 'action') return fail('bad_card');
    if (!canAttack(attacker)) return fail(attacker.summoningSick ? 'sick' : 'spent');
    if (intent.targetId === 'face') result = hitFace(next, seat, attacker);
    else result = hitCreature(next, seat, attacker, intent.targetId);
  } else {
    return fail('illegal');
  }
  if (!result.ok) return fail(result.error);
  // A full-table play refunds inside a half-updated seat. Detect it: playCard
  // returns ok only when the card actually left the hand for good. The 'full'
  // path returns before commit when caught early. See playCard.
  next.version += 1;
  const started = next.phase === 'main' && (state.phase === 'mulligan' || type === 'end');
  return { ok: true, state: next, turnStarted: started && next.phase !== 'over', over: next.phase === 'over' };
}

/** What this seat is allowed to send. The board lights buttons from this. */
export function legalIntents(state, seat) {
  const none = { mulligan: false, end: false, rally: false, play: [], attackers: [] };
  if (!state || state.phase === 'over' || (seat !== 'a' && seat !== 'b')) return none;
  if (state.phase === 'mulligan') return { ...none, mulligan: !state.mulligan[seat] };
  if (state.turn !== seat) return none;
  const side = state.seats[seat];
  const foe = state.seats[OTHER[seat]];
  const play = [];
  for (let i = 0; i < side.hand.length; i += 1) {
    const card = side.hand[i];
    if (side.energy < effectiveCost(card, side.field)) continue;
    if (card.type !== 'special' && side.field.length >= MAX_FIELD_SIZE) continue;
    play.push(card.instanceId);
  }
  const valid = getValidTargets(side.field, foe.field);
  const attackers = [];
  for (let i = 0; i < side.field.length; i += 1) {
    const card = side.field[i];
    if (!canAttack(card)) continue;
    const targets = valid.map((row) => row.instanceId);
    if (valid.length === 0 && canSwingFace(card)) targets.push('face');
    if (targets.length) attackers.push({ id: card.instanceId, targets });
  }
  const rally = side.momentum >= MOMENTUM_MAX && side.field.some((card) => card.type === 'action');
  return { mulligan: false, end: true, rally, play, attackers };
}

/**
 * What one seat is allowed to see. The opponent's hand and both deck orders
 * stay on the server. Deck sizes and the visible table do not.
 */
export function projectFor(state, seat) {
  if (seat !== 'a' && seat !== 'b') return null;
  const foe = OTHER[seat];
  const me = state.seats[seat];
  const them = state.seats[foe];
  const hideOrder = (cards) => cards.map((card) => ({ ...card }));
  return {
    you: seat,
    phase: state.phase,
    turn: state.turn,
    turnNumber: state.turnNumber,
    version: state.version,
    winner: state.winner,
    youWon: state.winner === seat,
    reason: state.reason,
    rules: state.rules,
    log: state.log.slice(-12),
    mvp: pickMvp(state.mvp),
    mulliganDone: !!state.mulligan[seat],
    legal: legalIntents(state, seat),
    self: {
      name: me.name,
      health: me.health,
      maxHealth: me.maxHealth,
      energy: me.energy,
      momentum: me.momentum,
      fatigue: me.fatigue,
      hand: hideOrder(me.hand),
      deckCount: me.deck.length,
      field: hideOrder(me.field),
      taunt: me.taunt,
      damage: me.stats.damage,
      healing: me.stats.healing,
      cards: me.stats.cards,
    },
    opponent: {
      name: them.name,
      health: them.health,
      maxHealth: them.maxHealth,
      energy: them.energy,
      momentum: them.momentum,
      fatigue: them.fatigue,
      handCount: them.hand.length,
      deckCount: them.deck.length,
      field: hideOrder(them.field),
      taunt: them.taunt,
    },
  };
}

/** True when a projection contains an opponent hand or a deck order. */
export function leaksHidden(view) {
  if (!view) return false;
  const text = JSON.stringify(view);
  if (view.opponent && Object.prototype.hasOwnProperty.call(view.opponent, 'hand')) return true;
  if (view.opponent && Object.prototype.hasOwnProperty.call(view.opponent, 'deck')) return true;
  if (view.self && Object.prototype.hasOwnProperty.call(view.self, 'deck')) return true;
  return text.includes('"deck":[');
}

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === 'object') {
    const out = {};
    for (const key of Object.keys(value).sort()) out[key] = stable(value[key]);
    return out;
  }
  return value;
}

export function stateHash(state) {
  return hashString(JSON.stringify(stable(state)));
}

/** Replay accepted intents from the deal. Rejected intents are not in the list. */
export function replay(setup, actions) {
  if (setup && setup.v != null && setup.v !== ENGINE_VERSION) {
    return { ok: false, error: 'incompatible', at: 0, state: null, hash: '' };
  }
  let state = createMatch(setup);
  const applied = [];
  for (let i = 0; i < actions.length; i += 1) {
    const action = actions[i];
    const result = applyIntent(state, action);
    if (!result.ok) return { ok: false, error: result.error, at: i, state, hash: stateHash(state) };
    state = result.state;
    applied.push(action);
  }
  return { ok: true, state, hash: stateHash(state), applied };
}

/** Every frame, including the deal. An old engine version is refused. */
export function framesFrom(setup, actions) {
  if (setup && setup.v != null && setup.v !== ENGINE_VERSION) {
    return { ok: false, error: 'incompatible', frames: [] };
  }
  let state = createMatch(setup);
  const frames = [state];
  for (let i = 0; i < (actions || []).length; i += 1) {
    const result = applyIntent(state, actions[i]);
    if (!result.ok) return { ok: false, error: result.error, at: i, frames, state };
    state = result.state;
    frames.push(state);
  }
  return { ok: true, frames, state, hash: stateHash(state) };
}
