import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ALL_CARDS, DAILY_REWARDS, PACK_ODDS, PACK_SLOTS, rollRarity, useGameStore } from '@/stores/gameStore';
import { NAUGHTY_LIST_CARDS, NAUGHTY_LIST_SEASON } from '@/data/naughtyList';
import {
  applySeasonSnapshot, collectiblePool, getSeasonSnapshot, resetSeasonSnapshot, seasonsForPacks, setSeasonPreview,
} from '@/lib/seasons';
import { rollPack } from '@/lib/packRoll';
import { buildOpponentDeck } from '@/utils/opponentDeck';
import { cardsFromIds } from '@/lib/social/ghostDeck';
import { deckProblem } from '@/lib/social/ladder';

const get = () => useGameStore.getState();
const XM = NAUGHTY_LIST_CARDS.map((card) => card.id);
const isXm = (id) => String(id).startsWith('xm-');
const xmOf = (ids) => (ids || []).filter(isXm);

const season = (status) => ({ ...NAUGHTY_LIST_SEASON, status });

const load = (status) => {
  applySeasonSnapshot({
    serverNow: '2026-11-10T00:00:00.000Z',
    seasons: status ? [season(status)] : [],
    loaded: status != null,
    previewId: '',
  });
};

const mulberry32 = (seed) => () => {
  seed |= 0;
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

const evergreenOwned = () => ALL_CARDS.filter((card) => !isXm(card.id)).map((card) => card.id);

const claimCardDay = (day) => {
  const now = new Date('2026-11-10T08:00:00Z');
  vi.setSystemTime(now);
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  useGameStore.setState(useGameStore.getInitialState(), true);
  useGameStore.setState({
    ownedCards: evergreenOwned(),
    lastLoginDate: yesterday.toDateString(),
    consecutiveLogins: day - 1,
    coins: 0,
  });
  return get().checkDailyLogin();
};

const opponentXm = (draws = 40) => {
  const found = [];
  for (let i = 0; i < draws; i += 1) {
    for (const difficulty of ['easy', 'normal', 'hard']) {
      const { cards } = buildOpponentDeck(difficulty, mulberry32(i * 17 + difficulty.length));
      found.push(...cards.map((card) => card.id).filter(isXm));
    }
  }
  return found;
};

const packXm = (draws = 60) => {
  const seasons = seasonsForPacks(getSeasonSnapshot(), { allowPreview: false });
  const found = [];
  for (let i = 0; i < draws; i += 1) {
    const pulled = rollPack({
      catalog: ALL_CARDS,
      seasons,
      packType: 'regular',
      slots: PACK_SLOTS,
      odds: PACK_ODDS,
      rollRarity,
      random: mulberry32(i + 1),
    });
    found.push(...pulled.map((card) => card.id).filter(isXm));
  }
  return found;
};

beforeEach(() => {
  localStorage.clear();
  resetSeasonSnapshot();
  setSeasonPreview('');
  useGameStore.setState(useGameStore.getInitialState(), true);
});

afterEach(() => {
  resetSeasonSnapshot();
  setSeasonPreview('');
  vi.useRealTimers();
});

describe('seasonal cards stay out of grants and sampled decks until the server opens the season', () => {
  const closed = [
    ['unloaded', null],
    ['upcoming', 'upcoming'],
    ['ended', 'ended'],
  ];

  it.each(closed)('daily login days 2, 4 and 6 grant no xm- id while %s', (_label, status) => {
    load(status);
    for (const day of [2, 4, 6]) {
      const reward = claimCardDay(day);
      expect(reward.day).toBe(day);
      expect(reward.cards).toBe(0);
      expect(xmOf(reward.cardIds)).toEqual([]);
      expect(xmOf(get().ownedCards)).toEqual([]);
      expect(DAILY_REWARDS[day - 1].cards).toBeGreaterThan(0);
    }
  });

  it('a preview flag does not open the daily pool', () => {
    load('upcoming');
    setSeasonPreview('naughty-list');
    const reward = claimCardDay(2);
    expect(xmOf(reward.cardIds)).toEqual([]);
    expect(xmOf(get().ownedCards)).toEqual([]);
  });

  it.each(closed)('opponent decks field no xm- id while %s', (_label, status) => {
    load(status);
    expect(opponentXm()).toEqual([]);
  });

  it.each(closed)('a battle pass card, a quest, and the crawl do not hand over an xm- id while %s', (_label, status) => {
    load(status);
    const pass = get().grantReward({ type: 'card', cardId: 'xm-santa', name: 'Sleazy Santa' });
    expect(pass.withheld).toBe(true);
    expect(pass.card).toBeUndefined();
    expect(get().ownedCards).not.toContain('xm-santa');

    useGameStore.setState({
      seasonQuest: { seasonId: 'naughty-list', wins: 1, cards: 8, packs: 1, claimed: [] },
      totalBattles: 10,
      weekBattles: 1,
      weekWins: 1,
      weekDamage: 40,
      weekCards: 8,
      crawlClaimedWeek: null,
    });
    expect(get().claimSeasonQuest('nl-stay')).toBeNull();
    const crawl = get().claimBarCrawl();
    if (crawl) expect(crawl.cards).toBeUndefined();
    expect(xmOf(get().ownedCards)).toEqual([]);
    expect(packXm()).toEqual([]);
  });

  it.each(closed)('a ghost deck and a ladder list drop xm- ids while %s', (_label, status) => {
    load(status);
    const pool = collectiblePool(ALL_CARDS);
    const known = new Set(pool.map((card) => card.id));
    expect(cardsFromIds(XM, pool).map((card) => card.id)).toEqual([]);
    expect(cardsFromIds(NAUGHTY_LIST_CARDS.map((card) => card.ladderId), pool)).toEqual([]);
    expect(deckProblem(XM, known)).toMatch(/does not serve/);
  });

  it('once the server marks the season active, those paths can deal xm- ids', () => {
    load('active');
    expect(collectiblePool(ALL_CARDS).filter((card) => isXm(card.id)).map((card) => card.id)).toEqual(XM);

    for (const day of [2, 4, 6]) {
      const reward = claimCardDay(day);
      expect(reward.cards).toBe(DAILY_REWARDS[day - 1].cards);
      expect(xmOf(reward.cardIds)).toEqual(reward.cardIds);
      expect(xmOf(get().ownedCards)).toEqual(reward.cardIds);
    }

    expect(opponentXm().length).toBeGreaterThan(0);

    useGameStore.setState(useGameStore.getInitialState(), true);
    const pass = get().grantReward({ type: 'card', cardId: 'xm-elf', name: 'Clocked-Out Elf' });
    expect(pass.card.id).toBe('xm-elf');
    expect(get().ownedCards).toContain('xm-elf');

    useGameStore.setState({
      seasonQuest: { seasonId: 'naughty-list', wins: 1, cards: 8, packs: 1, claimed: [] },
      totalBattles: 10,
      weekBattles: 1,
      weekWins: 1,
      weekDamage: 40,
      weekCards: 8,
    });
    const quest = get().claimSeasonQuest('nl-stay');
    expect(quest.coins).toBe(80);
    const crawl = get().claimBarCrawl();
    expect(crawl.packs).toBe(1);
    expect(packXm().length).toBeGreaterThan(0);

    const pool = collectiblePool(ALL_CARDS);
    const known = new Set(pool.map((card) => card.id));
    expect(cardsFromIds(XM, pool).map((card) => card.id)).toEqual(XM);
    expect(cardsFromIds(NAUGHTY_LIST_CARDS.map((card) => card.ladderId), pool).map((card) => card.id)).toEqual(XM);
    expect(deckProblem(XM, known)).toBeNull();
  });
});
