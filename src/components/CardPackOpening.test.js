import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createElement, act } from 'react';
import { createRoot } from 'react-dom/client';
import CardPackOpening, { openPackLabel } from './CardPackOpening';
import { REPEAT_BUY_MS } from './StoreTile';
import { BATTLE_PASS_REWARDS } from '@/lib/battlePass';
import { useGameStore, SHOP_ITEMS, DAILY_REWARDS, ALL_CARDS } from '@/stores/gameStore';
import { getCurrentSeason } from '@/utils/season';

// The empty table used to say "No packs available. Buy some below!" over a
// shop whose every tile was greyed out, and named no way to earn a pack. It
// now names the real sources with the real numbers, each derived here from
// the table that grants it, and offers the purchase when one is affordable.
const cheapest = SHOP_ITEMS.filter((i) => i.type === 'pack' && i.currency === 'coins')
  .reduce((a, b) => (a.price <= b.price ? a : b));
const firstPassPack = BATTLE_PASS_REWARDS.find((r) => r.free?.type === 'pack');
const firstDailyPack = DAILY_REWARDS.findIndex((r) => r.packs > 0) + 1;

// The timed reveal (Animations on) bursts confetti for a rare card, and jsdom
// has no canvas to draw it on.
vi.mock('@/lib/celebrate', () => ({ celebrate: vi.fn() }));

let host;
let root;
const render = (props = {}) => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  act(() => root.render(createElement(CardPackOpening, { onClose() {}, ...props })));
  return host;
};
const buttonNamed = (name) => [...host.querySelectorAll('button')].find((b) => (name instanceof RegExp ? name.test(b.textContent) : b.textContent === name));
const text = () => host.textContent.replace(/\s+/g, ' ');

beforeEach(() => {
  localStorage.clear();
  // A clean store, not resetProgress: a reset keeps gems, packs, the pass and
  // the claim ledgers, which would leak from one test into the next.
  useGameStore.setState(useGameStore.getInitialState(), true);
  useGameStore.setState({
    cardPacks: 0, premiumPacks: 0, legendaryPacks: 0, gems: 0,
    // A save stamped with this season: the panel rolls an older one over.
    seasonKey: getCurrentSeason().key, seasonXP: 0, claimedBattlePassRewards: { free: [], premium: [] },
    consecutiveLogins: 1, lastLoginDate: new Date().toDateString(),
    // celebrate() skips confetti with Animations off; jsdom has no canvas.
    animationsEnabled: false,
  });
});
afterEach(() => {
  act(() => root?.unmount());
  host?.remove();
  vi.restoreAllMocks();
});

describe('the empty Card Packs table', () => {
  it('names where the next pack comes from, with real numbers', () => {
    useGameStore.setState({ coins: 50 });
    render();
    expect(text()).not.toContain('No packs available');
    expect(text()).toContain(`${cheapest.name} · ${cheapest.price} coins`);
    expect(text()).toContain(`${cheapest.price - 50} more coins`);
    const bar = host.querySelector('[role="progressbar"]');
    expect(bar.getAttribute('aria-valuenow')).toBe(String(Math.round((50 / cheapest.price) * 100)));
    expect(text()).toContain(`Battle Pass tier ${firstPassPack.tier} · ${firstPassPack.free.amount} pack`);
    expect(text()).toContain(`${firstPassPack.xpRequired} XP to go`);
    // Claimed today on streak day 1: the first pack day is that many days on.
    expect(text()).toContain(`Login streak day ${firstDailyPack}`);
    expect(text()).toContain(`In ${firstDailyPack - 1} days`);
    // Nothing affordable, so no purchase is offered.
    expect([...host.querySelectorAll('button')].some((b) => /^Buy a /.test(b.textContent))).toBe(false);
  });

  it('says a reached Battle Pass pack is waiting', () => {
    useGameStore.setState({ coins: 0, seasonXP: firstPassPack.xpRequired });
    render();
    expect(text()).toContain(`Battle Pass tier ${firstPassPack.tier}`);
    expect(text()).toContain('claim it in the Battle Pass');
  });

  // A returning player's save still holds the ended season's XP and claims.
  // Read straight, the panel said a tier-8 pack was "Reached — claim it",
  // and opening the pass to claim it rolled the season and wiped it.
  //
  // Changed when a season's end started delivering every reached, unclaimed
  // tier: an unclaimed pack tier now arrives as packs (the next test), so
  // this save has claimed its whole free track and the table stays empty.
  it("reads the Battle Pass of this season, not the save's ended one", () => {
    const last = BATTLE_PASS_REWARDS[BATTLE_PASS_REWARDS.length - 1];
    useGameStore.setState({
      coins: 0,
      seasonKey: `season-${getCurrentSeason().number - 1}`,
      seasonXP: last.xpRequired,
      claimedBattlePassRewards: { free: BATTLE_PASS_REWARDS.map((r) => r.tier), premium: [] },
    });
    render();
    expect(useGameStore.getState().seasonKey).toBe(getCurrentSeason().key);
    expect(text()).toContain(`Battle Pass tier ${firstPassPack.tier} · ${firstPassPack.free.amount} pack`);
    expect(text()).toContain(`${firstPassPack.xpRequired} XP to go`);
    expect(text()).not.toContain('claim it in the Battle Pass');
  });

  it('opens on the packs an ended season delivered, rather than calling the table empty', () => {
    useGameStore.setState({
      coins: 0,
      seasonKey: `season-${getCurrentSeason().number - 1}`,
      seasonXP: firstPassPack.xpRequired,
      claimedBattlePassRewards: { free: [], premium: [] },
    });
    render();
    expect(useGameStore.getState().cardPacks).toBe(firstPassPack.free.amount);
    expect(text()).not.toContain('No packs to open');
    // The button's own words (a lone pack is "Open Pack", no count: the
    // count is of the tier it opens, and it shows only past one).
    expect(text()).toContain(openPackLabel('regular', firstPassPack.free.amount));
  });

  it('offers the pack when it is affordable, and buying it fills the table', () => {
    useGameStore.setState({ coins: cheapest.price });
    render();
    const buy = [...host.querySelectorAll('button')].find((b) => b.textContent === `Buy a ${cheapest.name}`);
    expect(buy).toBeTruthy();
    act(() => buy.click());
    expect(useGameStore.getState().cardPacks).toBe(cheapest.quantity);
    expect(useGameStore.getState().coins).toBe(0);
    expect(text()).not.toContain('No packs to open');
  });
});

// The table named where packs come from but could not take the player there.
// Each route is offered only where it leads to a pack.
describe("the empty table's routes", () => {
  const routes = () => ({ onGetGems: vi.fn(), onBattlePass: vi.fn(), onDailyRewards: vi.fn() });
  const cheapestGem = SHOP_ITEMS.filter((i) => ['pack', 'premium', 'legendary'].includes(i.type) && i.currency === 'gems')
    .reduce((a, b) => (a.price <= b.price ? a : b));

  it('sends a player short of gems to get them, and lets one with enough buy the gem pack', () => {
    const r = routes();
    useGameStore.setState({ coins: 0, gems: cheapestGem.price - 1 });
    render(r);
    expect(text()).toContain(`${cheapestGem.name} · ${cheapestGem.price} gems`);
    act(() => buttonNamed('Get gems').click());
    expect(r.onGetGems).toHaveBeenCalledTimes(1);
    act(() => root.unmount());

    useGameStore.setState({ gems: cheapestGem.price });
    render(r);
    expect(buttonNamed('Get gems')).toBeUndefined();
    act(() => buttonNamed(`Buy a ${cheapestGem.name}`).click());
    // Gems are spent from a confirm now (StoreTile's GemSpendConfirm), never
    // from the first press: nothing has gone until its Buy.
    expect(useGameStore.getState().gems).toBe(cheapestGem.price);
    const confirm = host.querySelector('[role="dialog"][aria-labelledby]');
    expect(confirm.textContent).toContain(`Buy ${cheapestGem.name}?`);
    // Its Buy takes no press for the first moment (a double-click's second
    // click lands on it), so this one comes after that.
    const opened = Date.now();
    vi.spyOn(Date, 'now').mockReturnValue(opened + REPEAT_BUY_MS);
    act(() => confirm.querySelector(`button[aria-label="Buy for ${cheapestGem.price} gems"]`).click());
    expect(useGameStore.getState().gems).toBe(0);
    expect(text()).not.toContain('No packs to open');
  });

  it('opens the Battle Pass only for a pack tier that is reached', () => {
    const r = routes();
    useGameStore.setState({ coins: 0, seasonXP: firstPassPack.xpRequired - 1 });
    render(r);
    expect(buttonNamed('Open the Battle Pass')).toBeUndefined();
    act(() => root.unmount());

    useGameStore.setState({ seasonXP: firstPassPack.xpRequired });
    render(r);
    act(() => buttonNamed('Open the Battle Pass').click());
    expect(r.onBattlePass).toHaveBeenCalledTimes(1);
  });

  it("opens Daily Rewards only when today's reward is unclaimed and pays packs", () => {
    const r = routes();
    render(r); // claimed today
    expect(buttonNamed('Open Daily Rewards')).toBeUndefined();
    act(() => root.unmount());

    // The streak continues from yesterday onto the first day that pays packs.
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    useGameStore.setState({ consecutiveLogins: firstDailyPack - 1, lastLoginDate: yesterday.toDateString() });
    render(r);
    expect(text()).toContain("Today's daily reward.");
    act(() => buttonNamed('Open Daily Rewards').click());
    expect(r.onDailyRewards).toHaveBeenCalledTimes(1);
  });
});

// The open button named one tier and counted all three: two standard, a
// Premium and a Legendary read "Open Legendary Pack (4)", four legendaries.
// It counts its own tier now; the wallet chip beside it has the total.
describe('the open button', () => {
  it('counts the packs of the tier it opens', () => {
    expect(openPackLabel('legendary', 1)).toBe('Open Legendary Pack');
    expect(openPackLabel('premium', 2)).toBe('Open Premium Pack (2)');
    expect(openPackLabel('regular', 3)).toBe('Open Pack (3)');
    expect(openPackLabel('regular', 1)).toBe('Open Pack');
  });

  it('names the next tier over a mixed inventory', () => {
    useGameStore.setState({ cardPacks: 2, premiumPacks: 1, legendaryPacks: 1 });
    render();
    const open = [...host.querySelectorAll('button')].find((b) => /^Open /.test(b.textContent));
    expect(open.textContent).toBe('Open Legendary Pack');
    act(() => root.unmount());
    useGameStore.setState({ cardPacks: 2, premiumPacks: 0, legendaryPacks: 0 });
    render();
    expect(buttonNamed('Open Pack (2)')).toBeTruthy();
  });
});

// The flavor line of the card turned last sits under the table, drawn as the
// Collection draws it (FlavorLine): the card's joke where the card is met. The
// store's pack roll is random, so the pull is stood in for with cards picked by
// id, and every expectation is read from ALL_CARDS by that id.
describe('the flavor line under the table', () => {
  const card = (id) => ALL_CARDS.find((c) => c.id === id);
  // Four commons and a rare: revealOrder keeps the commons in this order and
  // turns the rare, the best card, last.
  const FIVE = [1, 2, 31, 40, 13];
  const BEST = 13;
  // Ten commons: two waves of five, the best (last) in the second.
  const TEN = [1, 2, 3, 4, 5, 30, 31, 40, 41, 42];

  const stubPack = (ids, packs = 1) => useGameStore.setState({
    cardPacks: packs,
    openCardPack: () => {
      useGameStore.setState((s) => ({ cardPacks: s.cardPacks - 1 }));
      return { cards: ids.map((id, i) => ({ ...card(id), isNew: i === 0 })), dupeCoins: 0 };
    },
  });
  const zone = () => host.querySelector('[data-reveal-flavor]');
  const line = () => zone()?.querySelector('p') ?? null;
  const turnButton = (n) => host.querySelector(`button[aria-label^="Turn over card ${n}"]`);

  // Animations off: a pack opens straight to its cards, face up.
  const openFaceUp = async () => {
    useGameStore.setState({ animationsEnabled: false });
    render();
    act(() => buttonNamed(/^Open /).click());
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 5)); });
  };

  describe('with the pack opening face up', () => {
    it("shows the best card's line, exactly as the data has it", async () => {
      stubPack(FIVE);
      await openFaceUp();
      expect(line().textContent).toBe(card(BEST).description);
      expect(line().getAttribute('data-flavor-of')).toBe(String(BEST));
      // Beside the line, for a screen reader: whose it is.
      expect(zone().querySelector('.sr-only').textContent).toBe(card(BEST).name);
    });

    it('is real content under the table, not a control, a live region or hidden', async () => {
      stubPack(FIVE);
      await openFaceUp();
      expect(line().closest('[aria-hidden="true"]')).toBeNull();
      expect(zone().closest('[aria-live], [role="status"]')).toBeNull();
      expect(zone().querySelector('button, a, [tabindex]')).toBeNull();
      // After the table, before the way on.
      const table = host.querySelector('[data-reveal-table]');
      const done = buttonNamed('Done');
      expect(table.compareDocumentPosition(zone()) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
      expect(zone().compareDocumentPosition(done) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    });

    it('follows the wave on the table: the best of it, and back', async () => {
      stubPack(TEN);
      await openFaceUp();
      expect(line().getAttribute('data-flavor-of')).toBe('42');
      act(() => buttonNamed('Cards 1–5').click());
      expect(line().textContent).toBe(card(5).description);
      act(() => buttonNamed('Cards 6–10').click());
      expect(line().textContent).toBe(card(42).description);
    });
  });

  describe('as the cards are turned', () => {
    beforeEach(() => {
      // Only the reveal's timers: framer-motion's frames stay real.
      vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
      useGameStore.setState({ animationsEnabled: true });
    });
    afterEach(() => { vi.useRealTimers(); });

    const advance = (ms) => act(async () => { vi.advanceTimersByTime(ms); });
    // Press Open, let the pack tear and the cards be dealt.
    const openAndDeal = async () => {
      act(() => buttonNamed(/^Open /).click());
      await advance(1200);
      await advance(1000);
    };

    it("keeps the line's room from the deal, and shows nothing of a card before it turns", async () => {
      stubPack(FIVE);
      render();
      await openAndDeal();
      expect(turnButton(1)).toBeTruthy();
      // Room reserved, nothing in it: no card's line is on the page face down.
      expect(zone()).not.toBeNull();
      expect(line()).toBeNull();
      for (const id of FIVE) {
        expect(host.textContent, `card ${id}'s line before it turns`).not.toContain(card(id).description);
      }
    });

    it("shows each card's line as it turns, and only the last turned", async () => {
      stubPack(FIVE);
      render();
      await openAndDeal();
      act(() => turnButton(1).click());
      expect(line().textContent).toBe(card(1).description);
      expect(line().getAttribute('data-flavor-of')).toBe('1');
      act(() => turnButton(2).click());
      expect(line().textContent).toBe(card(2).description);
      expect(host.textContent).not.toContain(card(1).description);
    });

    it("shows the best card's line when everything is turned at once", async () => {
      stubPack(FIVE);
      render();
      await openAndDeal();
      act(() => turnButton(1).click());
      act(() => buttonNamed('Reveal all').click());
      expect(line().textContent).toBe(card(BEST).description);
    });

    // Two cards of the best rarity: the line is the one the turns would have
    // ended on, the last, not the first of them.
    it("ends on the last card's line when the best rarity is shared", async () => {
      stubPack([1, 6, 8]);
      render();
      await openAndDeal();
      act(() => buttonNamed('Reveal all').click());
      expect(card(6).rarity).toBe(card(8).rarity);
      expect(line().getAttribute('data-flavor-of')).toBe('8');
      expect(line().textContent).toBe(card(8).description);
    });

    it('starts the next pack with no line, until one of its cards turns', async () => {
      stubPack(FIVE, 2);
      render();
      await openAndDeal();
      act(() => buttonNamed('Reveal all').click());
      // The reveal ends on its own timer; then the way on is Open Another.
      await advance(2000);
      expect(line()).not.toBeNull();
      act(() => buttonNamed(/^Open /).click());
      await advance(1200);
      await advance(1000);
      expect(zone()).not.toBeNull();
      expect(line()).toBeNull();
    });
  });
});
