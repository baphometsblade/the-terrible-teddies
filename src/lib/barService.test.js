import { describe, expect, it } from 'vitest';
import { LAST_CALL_HP } from '@/stores/gameStore';
import {
  LAST_ORDERS_HP, POUR_EXTRA, applyCutoff, applyInterest, commitBarSpecial,
  energyAfterCut, ordersBonus, payTab, playBarSpecial, pourExtra, tabTip,
} from './barService';

const bear = (over = {}) => ({
  type: 'action', instanceId: over.instanceId || 'b', attack: 2, defense: 4, currentHp: 2, ability: 'none', ...over,
});

describe('Chuck pours, calls last orders, cuts someone off, and runs the tab', () => {
  it('uses the same last-call line the board already does', () => {
    expect(LAST_ORDERS_HP).toBe(LAST_CALL_HP);
  });

  it('tops a heal by 2 while Chuck is on the bar', () => {
    expect(pourExtra([])).toBe(0);
    expect(pourExtra([bear({ ability: 'pour' })])).toBe(POUR_EXTRA);
    const poured = playBarSpecial(
      { name: 'Hair of the Bear', type: 'special', effect: 'heal', amount: 3 },
      { health: 10, maxHealth: 30, field: [bear({ ability: 'pour' })] },
    );
    expect(poured).toBeNull();
  });

  it('tops you and every wounded glass when Top-Up is played', () => {
    const full = bear({ instanceId: 'full', currentHp: 4, defense: 4 });
    const hurt = bear({ instanceId: 'hurt', currentHp: 1, defense: 4 });
    const trap = { type: 'trap', instanceId: 't' };
    const done = commitBarSpecial({
      health: 28, maxHealth: 30, field: [full, hurt, trap], deck: [], hand: [],
    }, { name: 'Top-Up', type: 'special', effect: 'topUp', amount: 2 });
    expect(done.healed).toBe(2);
    expect(done.health).toBe(30);
    expect(done.topped).toBe(2);
    expect(done.field.find((c) => c.instanceId === 'hurt').currentHp).toBe(3);
    expect(done.field.find((c) => c.instanceId === 'full').currentHp).toBe(4);
    expect(done.field.find((c) => c.instanceId === 't')).toBe(trap);
    const stuffed = playBarSpecial(
      { name: 'Top-Up', type: 'special', effect: 'topUp', amount: 2 },
      { health: 30, maxHealth: 30, field: [full] },
    );
    expect(stuffed.healed).toBe(0);
    expect(stuffed.topped).toBe(0);
  });

  it('makes last orders a real round only at last call, and waters it before', () => {
    const ally = bear({ instanceId: 'a', attack: 3 });
    const early = commitBarSpecial({
      health: 12, maxHealth: 30, field: [ally], deck: [], hand: [],
    }, { name: 'Last Orders', type: 'special', effect: 'lastOrders', amount: 6 });
    expect(early.desperate).toBe(false);
    expect(early.healed).toBe(3);
    expect(early.buff).toBe(0);
    expect(early.field[0].attack).toBe(3);

    const late = commitBarSpecial({
      health: 5, maxHealth: 30, field: [ally, { type: 'trap' }], deck: [], hand: [],
    }, { name: 'Last Orders', type: 'special', effect: 'lastOrders', amount: 6 });
    expect(late.desperate).toBe(true);
    expect(late.healed).toBe(6);
    expect(late.field[0].attack).toBe(4);
    expect(late.field[1].type).toBe('trap');

    const withChuck = playBarSpecial(
      { name: 'Last Orders', type: 'special', effect: 'lastOrders', amount: 6 },
      { health: 4, maxHealth: 30, field: [bear({ ability: 'pour' })] },
    );
    expect(withChuck.healed).toBe(8);
  });

  it('gives Closing-Time Chuck +2 attack only when the lights are up', () => {
    const him = { ability: 'orders', attack: 3 };
    expect(ordersBonus(him, 6)).toBe(0);
    expect(ordersBonus(him, 5)).toBe(2);
    expect(ordersBonus(him, 0)).toBe(2);
    expect(ordersBonus({ ability: 'none' }, 1)).toBe(0);
    expect(ordersBonus(him, undefined)).toBe(0);
  });

  it('cuts the next round short by the printed amount', () => {
    const cut = playBarSpecial(
      { name: "You're Cut Off", type: 'special', effect: 'cutOff', amount: 2 },
      { health: 30, maxHealth: 30 },
    );
    expect(cut.energyCut).toBe(2);
    expect(energyAfterCut(4, cut.energyCut)).toBe(2);
    expect(energyAfterCut(1, 4)).toBe(0);
  });

  it('puts cards on the tab and collects the bill next round', () => {
    const deck = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
    const open = commitBarSpecial({
      health: 20, maxHealth: 30, field: [], deck, hand: [{ id: 'played' }], handRoom: 8,
    }, { name: 'On the Tab', type: 'special', effect: 'onTab', amount: 2 });
    expect(open.drawn).toBe(2);
    expect(open.due).toBe(2);
    expect(open.hand.map((c) => c.id)).toEqual(['played', 'a', 'b']);
    expect(open.deck.map((c) => c.id)).toEqual(['c']);
    const dry = commitBarSpecial({
      health: 20, maxHealth: 30, field: [], deck: [], hand: [], handRoom: 0,
    }, { name: 'On the Tab', type: 'special', effect: 'onTab', amount: 2 });
    expect(dry.drawn).toBe(0);
    expect(dry.due).toBe(2);
    expect(payTab(20, dry.due)).toEqual({ health: 18, paid: 2 });
    expect(payTab(1, 2)).toEqual({ health: 0, paid: 1 });
  });

  it('sits a survivor out after Off-Duty Chuck connects, and leaves a kill alone', () => {
    const chuck = { ability: 'cutoff', name: 'Off-Duty Chuck' };
    const lived = applyCutoff(chuck, { instanceId: 'x', currentHp: 2 });
    expect(lived.hungover).toBe(true);
    expect(applyCutoff(chuck, null)).toBeNull();
    expect(applyCutoff({ ability: 'none' }, { currentHp: 2 }).hungover).toBeUndefined();
  });

  it('gives 1 HP back at the end of a turn Tabitha is still standing', () => {
    expect(tabTip([])).toBe(0);
    expect(tabTip([bear({ ability: 'tab' })])).toBe(1);
    expect(tabTip([{ type: 'trap', ability: 'tab' }])).toBe(0);
  });

  it('takes a point of attack when The Quiet Word collects interest', () => {
    const swung = { type: 'action', attack: 4, name: 'Rita' };
    const trap = { name: 'The Quiet Word', interest: 1, amount: 3 };
    expect(applyInterest(swung, trap).attack).toBe(3);
    expect(applyInterest({ type: 'action', attack: 0 }, trap).attack).toBe(0);
    expect(applyInterest(swung, { amount: 3 })).toBe(swung);
    expect(applyInterest({ type: 'trap', attack: 4 }, trap).attack).toBe(4);
  });
});
