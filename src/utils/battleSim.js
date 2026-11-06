// Headless AI-vs-AI. Both sides play with the same rules the board uses
// (energy, summoning sickness, taunt/protect/stealth, shield, fury, traps,
// heal and buff). There is no hand: each side plays from its deck the way
// Chuck does, so a draw special only spends itself. That is enough to see
// which bodies win too often. Not the campaign. A measuring stick.

import { ALL_CARDS } from '@/stores/gameStore';
import {
  canAttack, effectiveAttack, getValidTargets, readyCreatures, resolveCreatureHit,
} from '@/utils/battleUtils';
import { chooseAttackTarget, chooseOpponentPlays } from '@/utils/opponentAI';
import { energyForTurn, MAX_FIELD_SIZE } from '@/components/GameBoard/turn';

export const SIM_MAX_TURNS = 30;
const START_HP = 30;

export const mulberry32 = (seed) => {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

const shuffle = (cards, random) => {
  const out = [...cards];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
};

const stamp = (card, id) => ({
  ...card,
  instanceId: id,
  currentHp: card.defense ?? 0,
  summoningSick: true,
  hasAttacked: false,
  ...(card.ability === 'stealth' ? { stealthActive: true } : {}),
});

const makeSide = (cards, side, random) => {
  const deck = shuffle(cards, random).map((card, i) => ({ ...card, instanceId: `${side}-${i}` }));
  const opener = deck[0];
  return {
    hp: START_HP,
    fatigue: 0,
    deck: deck.slice(1),
    field: opener ? [stamp(opener, opener.instanceId)] : [],
  };
};

const applySpecial = (side, card) => {
  if (card.effect === 'heal') side.hp = Math.min(START_HP, side.hp + (card.amount || 0));
  if (card.effect === 'buff') {
    side.field = side.field.map((c) => (
      c.type === 'action' ? { ...c, attack: c.attack + (card.amount || 0) } : c
    ));
  }
};

const takeTurn = (actor, defender, turn) => {
  actor.field = actor.field.map((c) => ({ ...c, stealthActive: false }));
  if (actor.deck.length === 0) {
    actor.fatigue += 1;
    actor.hp -= actor.fatigue;
    if (actor.hp <= 0) return;
  }
  const energy = energyForTurn(turn);
  const { plays, remainingDeck } = chooseOpponentPlays(
    actor.deck, actor.field.length, energy, MAX_FIELD_SIZE, actor.field,
  );
  actor.deck = remainingDeck;
  for (const card of plays) {
    if (card.type === 'special') applySpecial(actor, card);
    else actor.field.push(stamp(card, card.instanceId));
  }
  const attackers = actor.field.filter(canAttack);
  for (const attacker of attackers) {
    if (actor.hp <= 0 || defender.hp <= 0) break;
    const targets = getValidTargets(actor.field, defender.field);
    if (targets.length === 0) {
      const trap = defender.field.find((c) => c.type === 'trap');
      if (trap) {
        actor.hp -= trap.amount || 3;
        defender.field = defender.field.filter((c) => c.instanceId !== trap.instanceId);
      }
      defender.hp -= effectiveAttack(attacker, actor.field);
    } else {
      const target = chooseAttackTarget(targets, attacker, actor.field);
      const hit = resolveCreatureHit(attacker, target, actor.field);
      defender.hp -= hit.overkill;
      defender.field = defender.field.flatMap((c) => (
        c.instanceId === target.instanceId ? (hit.survivor ? [hit.survivor] : []) : [c]
      ));
    }
    actor.field = actor.field.map((c) => (
      c.instanceId === attacker.instanceId ? { ...c, hasAttacked: true } : c
    ));
  }
  actor.field = readyCreatures(actor.field);
};

/**
 * One game. `deckA` and `deckB` are card objects. Returns 'a', 'b', or 'draw'.
 */
export const simulateGame = (deckA, deckB, random = Math.random) => {
  const a = makeSide(deckA, 'a', random);
  const b = makeSide(deckB, 'b', random);
  for (let turn = 1; turn <= SIM_MAX_TURNS && a.hp > 0 && b.hp > 0; turn += 1) {
    takeTurn(a, b, turn);
    if (a.hp <= 0 || b.hp <= 0) break;
    takeTurn(b, a, turn);
  }
  if (a.hp <= 0 && b.hp <= 0) return 'draw';
  if (b.hp <= 0) return 'a';
  if (a.hp <= 0) return 'b';
  if (a.hp === b.hp) return 'draw';
  return a.hp > b.hp ? 'a' : 'b';
};

const sampleDeck = (pool, size, random) => {
  const bag = [...pool];
  const deck = [];
  while (deck.length < size && bag.length) {
    const i = Math.floor(random() * bag.length);
    deck.push(bag.splice(i, 1)[0]);
  }
  return deck;
};

/**
 * `games` random matchups. A card in both decks is ignored for that game,
 * so a mirror does not drag everyone toward 50%.
 */
export const simulateField = ({ games = 2000, seed = 1, deckSize = 10, pool = ALL_CARDS } = {}) => {
  const random = mulberry32(seed);
  const tally = new Map();
  const note = (deck, won) => {
    for (const id of new Set(deck.map((c) => c.id))) {
      const row = tally.get(id) || { id, wins: 0, games: 0 };
      row.games += 1;
      if (won) row.wins += 1;
      tally.set(id, row);
    }
  };
  let draws = 0;
  for (let n = 0; n < games; n += 1) {
    const a = sampleDeck(pool, deckSize, random);
    const b = sampleDeck(pool, deckSize, random);
    const shared = new Set(a.map((c) => c.id).filter((id) => b.some((c) => c.id === id)));
    const result = simulateGame(a, b, random);
    if (result === 'draw') draws += 1;
    note(a.filter((c) => !shared.has(c.id)), result === 'a');
    note(b.filter((c) => !shared.has(c.id)), result === 'b');
  }
  const rows = [...tally.values()].map((row) => ({
    ...row,
    name: pool.find((c) => c.id === row.id)?.name ?? String(row.id),
    rate: row.games ? row.wins / row.games : 0,
  })).sort((x, y) => y.rate - x.rate);
  return { games, draws, rows };
};
