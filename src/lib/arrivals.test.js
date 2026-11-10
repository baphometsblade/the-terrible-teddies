import { describe, expect, it } from 'vitest';
import { canAttack, damageToCreatureHp, readyCreatures, resolveCreatureHit } from '@/utils/battleUtils';
import {
  flipCoin, mistletoeKiss, regiftAttack, resolveArrival, spillEggnog,
} from '@/lib/arrivals';
import { NAUGHTY_LIST_CARDS } from '@/data/naughtyList';

const byId = (id) => NAUGHTY_LIST_CARDS.find((card) => card.id === id);
const bear = (over) => ({
  id: over.id || 'x',
  name: over.name || 'Bear',
  type: 'action',
  ability: 'none',
  attack: 2,
  defense: 3,
  currentHp: 3,
  instanceId: over.instanceId,
  ...over,
});

describe('Naughty or Nice', () => {
  it('flips Nice below a half and Naughty from there up', () => {
    expect(flipCoin(() => 0)).toBe('nice');
    expect(flipCoin(() => 0.49)).toBe('nice');
    expect(flipCoin(() => 0.5)).toBe('naughty');
    expect(flipCoin(() => 0.99)).toBe('naughty');
  });

  it('gives The Naughty List +2 attack on Nice and 2 face damage on Naughty', () => {
    const card = { ...byId('xm-list'), instanceId: 'list', currentHp: 4 };
    const nice = resolveArrival({
      card, ownField: [card], enemyField: [], ownHp: 20, enemyHp: 30, random: () => 0,
    });
    expect(nice.ownField[0].attack).toBe(5);
    expect(nice.enemyHp).toBe(30);
    expect(nice.logs.join(' ')).toMatch(/Nice/);

    const naughty = resolveArrival({
      card, ownField: [card], enemyField: [], ownHp: 20, enemyHp: 30, random: () => 0.9,
    });
    expect(naughty.ownField[0].attack).toBe(3);
    expect(naughty.enemyHp).toBe(28);
    expect(naughty.damageToEnemy).toBe(2);
    expect(naughty.logs.join(' ')).toMatch(/Naughty/);
  });

  it('heals 3 on a Nice sack and deals 3 on a Naughty one, and stops at full', () => {
    const card = { ...byId('xm-santa'), instanceId: 'santa', currentHp: 4 };
    const nice = resolveArrival({
      card, ownField: [card], enemyField: [], ownHp: 28, enemyHp: 10, maxHp: 30, random: () => 0,
    });
    expect(nice.ownHp).toBe(30);
    expect(nice.healing).toBe(2);
    const naughty = resolveArrival({
      card, ownField: [card], enemyField: [], ownHp: 30, enemyHp: 2, random: () => 0.8,
    });
    expect(naughty.enemyHp).toBe(0);
    expect(naughty.damageToEnemy).toBe(3);
  });
});

describe('Mistletoe', () => {
  it('kisses the bear opposite and swaps their seats', () => {
    const mandy = { ...byId('xm-mistletoe'), instanceId: 'mandy', currentHp: 4 };
    const left = bear({ instanceId: 'left', name: 'Left', attack: 6 });
    const right = bear({ instanceId: 'right', name: 'Right', attack: 1 });
    const swapped = mistletoeKiss([mandy, bear({ instanceId: 'pal', name: 'Pal' })], [left, right], 'mandy');
    expect(swapped.ownField[0].instanceId).toBe('left');
    expect(swapped.enemyField[0].instanceId).toBe('mandy');
    expect(swapped.ownField[0].kissed).toBe(true);
    expect(swapped.enemyField[0].kissed).toBe(true);
    expect(canAttack(swapped.ownField[0])).toBe(false);
    expect(canAttack(swapped.enemyField[0])).toBe(false);
    const [woke] = readyCreatures([swapped.ownField[0]]);
    expect(woke.kissed).toBe(false);
    expect(canAttack({ ...woke, summoningSick: false, hungover: false })).toBe(true);
    expect(swapped.ownField[1].instanceId).toBe('pal');
  });

  it('does nothing to the seats when the other side is empty', () => {
    const mandy = { ...byId('xm-mistletoe'), instanceId: 'mandy' };
    const stayed = resolveArrival({
      card: mandy, ownField: [mandy], enemyField: [], ownHp: 30, enemyHp: 30,
    });
    expect(stayed.ownField.map((card) => card.instanceId)).toEqual(['mandy']);
    expect(stayed.logs.join(' ')).toMatch(/Nobody is opposite/);
  });
});

describe('Eggnog and Regift', () => {
  it('makes a random enemy miss their next swing', () => {
    const eddie = { ...byId('xm-nog'), instanceId: 'eddie', currentHp: 3 };
    const a = bear({ instanceId: 'a', name: 'A' });
    const b = bear({ instanceId: 'b', name: 'B' });
    const spilled = spillEggnog([a, b], () => 0.9);
    expect(spilled.target.instanceId).toBe('b');
    expect(spilled.enemyField[1].hungover).toBe(true);
    expect(canAttack(spilled.enemyField[1])).toBe(false);
    expect(canAttack(spilled.enemyField[0])).toBe(true);
    const nice = resolveArrival({
      card: eddie, ownField: [eddie], enemyField: [a, b], ownHp: 30, enemyHp: 30, random: () => 0,
    });
    expect(nice.enemyField.some((card) => card.hungover)).toBe(false);
    expect(nice.ownField[0].attack).toBe(eddie.attack + 1);
    const naughty = resolveArrival({
      card: eddie, ownField: [eddie], enemyField: [a, b], ownHp: 30, enemyHp: 30, random: () => 0.9,
    });
    expect(naughty.enemyField.some((card) => card.hungover)).toBe(true);
    expect(naughty.ownField[0].attack).toBe(eddie.attack);
    const drank = resolveArrival({
      card: eddie, ownField: [eddie], enemyField: [], ownHp: 30, enemyHp: 30, random: () => 0,
    });
    expect(drank.ownField[0].attack).toBe(eddie.attack + 1);
  });

  it('swaps attack with a random enemy and leaves the bodies where they are', () => {
    const stan = { ...byId('xm-secret'), instanceId: 'stan', currentHp: 4, attack: 2 };
    const victim = bear({ instanceId: 'v', name: 'Victim', attack: 7 });
    const gifted = regiftAttack([stan], [victim], 'stan', () => 0);
    expect(gifted.ownField[0].attack).toBe(7);
    expect(gifted.enemyField[0].attack).toBe(2);
    expect(gifted.ownField[0].instanceId).toBe('stan');
    expect(gifted.enemyField[0].currentHp).toBe(3);
  });
});

describe('Encore', () => {
  it('ignores Shield and takes it off a bear that lives', () => {
    const elf = { ...byId('xm-elf'), instanceId: 'elf' };
    const wall = bear({ instanceId: 'wall', name: 'Wall', ability: 'shield', attack: 1, defense: 8, currentHp: 8 });
    expect(damageToCreatureHp(elf, wall)).toBe(3);
    expect(damageToCreatureHp({ attack: 3, ability: 'none' }, wall)).toBe(1);
    const lived = resolveCreatureHit(elf, wall);
    expect(lived.survivor.ability).toBe('none');
    expect(lived.survivor.currentHp).toBe(5);
    const frail = { ...wall, currentHp: 2 };
    const ruined = resolveCreatureHit(elf, frail);
    expect(ruined.survivor).toBeNull();
  });
});
