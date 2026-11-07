import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { useGameStore, ALL_CARDS, coinsForDuplicate, BATTLE_XP } from '@/stores/gameStore';
import { eventAt, scaleReward, HOUSE_EVENTS, eventSpentKey } from './houseEvents';
import { crawlStatus, CRAWL_UNLOCK_BATTLES } from './barCrawl';
import { nextStarTarget, starCost, starSetReady, normalizeStars, STAR_CAP } from './cardStars';
import { morningAfterDue, MORNING_AFTER } from './morningAfter';
import { LEVEL_TRACK, levelMark } from './levelTrack';
import { catchUpFor } from './catchUp';
import { storyChapters } from './storyCampaign';
import { plaqueBonus, PLAQUES } from './plaques';
import { houseUnlocks } from './milestones';
import { RETENTION_MARKS, isRetentionMark, starMark } from './retentionMarks';
import { weekKeyOf } from './questReroll';

const at = (y, m, d, h = 12) => new Date(y, m - 1, d, h, 30);

const houseLines = (rows) => rows.flatMap((row) => [row.name, row.blurb, row.line, row.opening, row.closing].filter(Boolean));

describe('limited nights', () => {
  it('lets a special day beat happy hour, and stays dark in the afternoon', () => {
    // 7 Nov 2026 is a Saturday. 5 Nov 2026 is a Thursday.
    expect(eventAt(at(2026, 11, 7, 18)).id).toBe('stag_do');
    expect(eventAt(at(2026, 11, 5, 18)).id).toBe('ladies_night');
    expect(eventAt(at(2026, 11, 4, 18)).id).toBe('happy_hour');
    expect(eventAt(at(2026, 11, 4, 12))).toBeNull();
    expect(scaleReward(30, 3, 2)).toBe(45);
    expect(scaleReward(50, 2, 1)).toBe(100);
    expect(HOUSE_EVENTS.map((event) => event.id)).toEqual(['stag_do', 'ladies_night', 'happy_hour']);
  });
});

describe('bar crawl', () => {
  it('lights the stops in order and pays once the week is walked', () => {
    const locked = crawlStatus({ totalBattles: 1, weekBattles: 5, weekWins: 5, weekDamage: 100, weekCards: 20 }, 'week');
    expect(locked.unlocked).toBe(false);
    const early = crawlStatus({
      totalBattles: CRAWL_UNLOCK_BATTLES, weekBattles: 1, weekWins: 1, weekDamage: 10, weekCards: 2,
    }, 'week');
    expect(early.stops.map((stop) => stop.met)).toEqual([true, true, false, false]);
    const done = crawlStatus({
      totalBattles: 4, weekBattles: 2, weekWins: 1, weekDamage: 40, weekCards: 8,
    }, 'week');
    expect(done.done).toBe(true);
    expect(done.claimed).toBe(false);
    expect(crawlStatus({
      totalBattles: 4, weekBattles: 2, weekWins: 1, weekDamage: 40, weekCards: 8, crawlClaimedWeek: 'week',
    }, 'week').claimed).toBe(true);
  });
});

describe('card stars', () => {
  const commons = ALL_CARDS.filter((card) => card.rarity === 'common');

  it('spends the dupe price for the next star and stops at three', () => {
    const owned = commons.map((card) => card.id);
    const first = nextStarTarget(ALL_CARDS, owned, {}, 'common');
    expect(first.id).toBe(commons[0].id);
    expect(starCost(first.id, {}, coinsForDuplicate)).toBe(coinsForDuplicate(first.id));
    const two = { [String(first.id)]: 2 };
    expect(starCost(first.id, two, coinsForDuplicate)).toBe(coinsForDuplicate(first.id) * 3);
    expect(starCost(first.id, { [String(first.id)]: STAR_CAP }, coinsForDuplicate)).toBeNull();
    expect(starSetReady(ALL_CARDS, owned, {}, 'common')).toBe(false);
    const starred = Object.fromEntries(owned.map((id) => [String(id), 1]));
    expect(starSetReady(ALL_CARDS, owned, starred, 'common')).toBe(true);
    expect(normalizeStars({ 1: 4, 2: 1, no: 2 }, [1, 2])[String(2)]).toBe(1);
    expect(normalizeStars({ 1: 4 }, [1])[String(1)]).toBeUndefined();
  });
});

describe('the other retention offers', () => {
  it('gives a morning-after only for a fight yesterday', () => {
    const now = at(2026, 11, 7);
    const yesterday = at(2026, 11, 6).toDateString();
    expect(morningAfterDue({ lastBattleDate: yesterday }, now)).toBe(true);
    expect(morningAfterDue({ lastBattleDate: yesterday, morningAfterDate: now.toDateString() }, now)).toBe(false);
    expect(morningAfterDue({ lastBattleDate: now.toDateString() }, now)).toBe(false);
    expect(MORNING_AFTER.coins).toBe(40);
  });

  it('catches a quiet player up once a week, and leaves a busy one alone', () => {
    const now = at(2026, 11, 20);
    const first = at(2026, 11, 1).toDateString();
    const offer = catchUpFor({ firstSeenDate: first, level: 1, catchUpWeek: null }, now, 'week');
    expect(offer.coins).toBeGreaterThan(0);
    expect(offer.packs).toBe(1);
    expect(catchUpFor({ firstSeenDate: first, level: 1, catchUpWeek: 'week' }, now, 'week')).toBeNull();
    expect(catchUpFor({ firstSeenDate: first, level: 40 }, now, 'week')).toBeNull();
    expect(catchUpFor({ firstSeenDate: null, level: 1 }, now, 'week')).toBeNull();
  });

  it('keeps chapter two shut until the first round is closed', () => {
    const fresh = storyChapters({ totalWins: 10, totalBattles: 10, ownedCards: ALL_CARDS.map((c) => c.id), level: 9, totalDamageDealt: 500 });
    expect(fresh[0].ready).toBe(true);
    expect(fresh[1].locked).toBe(true);
    const open = storyChapters({
      totalWins: 8, totalBattles: 8, ownedCards: ALL_CARDS.slice(0, 15).map((c) => c.id),
      level: 5, totalDamageDealt: 200, claimedChapters: ['story_first_round'],
    });
    expect(open[1].locked).toBe(false);
    expect(open[1].ready).toBe(true);
  });

  it('pays a plaque once the level is there, and sweetens the daily by ten a plaque', () => {
    expect(plaqueBonus([])).toBe(0);
    expect(plaqueBonus(PLAQUES.map((plaque) => plaque.id))).toBe(30);
    expect(PLAQUES.map((plaque) => plaque.level)).toEqual([10, 25, 50]);
  });

  it('opens the back room in the order a new face earns it', () => {
    const fresh = houseUnlocks({ ownedCards: [1], totalBattles: 0, level: 1, claimedChapters: [] });
    expect(fresh.map((row) => row.open)).toEqual([false, false, false, false]);
    const opened = houseUnlocks({ ownedCards: Array.from({ length: 8 }, (_, i) => i + 1), totalBattles: 3, level: 10, claimedChapters: ['story_first_round'] });
    expect(opened.every((row) => row.open)).toBe(true);
  });

  it('keeps the level track and the house lines fit for a phone', () => {
    expect(LEVEL_TRACK.map((row) => row.level)).toEqual([2, 3, 5, 8, 10, 15, 20, 25, 35, 50]);
    const lines = [
      ...houseLines(HOUSE_EVENTS),
      ...houseLines(PLAQUES),
      ...LEVEL_TRACK.map((row) => row.line),
      ...storyChapters({}).flatMap((chapter) => [chapter.opening, chapter.closing, chapter.name]),
    ];
    for (const line of lines) {
      expect(line.length, line).toBeLessThanOrEqual(80);
      expect(line, line).not.toMatch(/!/);
      expect(line, line).not.toContain("'");
    }
  });
});

describe('retention marks', () => {
  it('is the allowlist the migration will store', () => {
    const sql = readFileSync(resolve(process.cwd(), 'supabase/migrations/20261107160000_retention_marks.sql'), 'utf8');
    const list = sql.slice(sql.indexOf('v_mark NOT IN'), sql.indexOf('THEN', sql.indexOf('v_mark NOT IN')));
    const ids = [...list.matchAll(/'([a-z0-9_]+)'/g)].map((match) => match[1]);
    expect(ids).toEqual([...RETENTION_MARKS]);
    expect(isRetentionMark(levelMark(2))).toBe(true);
    expect(isRetentionMark(starMark('common'))).toBe(true);
    expect(isRetentionMark('crawl')).toBe(false);
    expect(sql).toMatch(/auth\.uid\(\)/);
    expect(sql).toMatch(/ENABLE ROW LEVEL SECURITY/);
    expect(sql).toMatch(/REVOKE ALL ON TABLE public\.retention_marks FROM PUBLIC, anon, authenticated/);
    expect(sql).toMatch(/PT429/);
  });
});

describe('the store runs the second wave', () => {
  beforeEach(() => {
    localStorage.clear();
    useGameStore.setState(useGameStore.getInitialState(), true);
  });
  afterEach(() => vi.useRealTimers());

  it('arms one fight of a live night and then spends it', () => {
    vi.useFakeTimers();
    vi.setSystemTime(at(2026, 11, 4, 18));
    expect(useGameStore.getState().armHouseEvent().id).toBe('happy_hour');
    const paid = useGameStore.getState().recordBattleResult(true, 10, 0, 30, 1, 0);
    expect(paid.event).toBe('happy_hour');
    expect(paid.xpGain).toBe(BATTLE_XP.win * 2);
    expect(paid.coinsGain).toBe(30);
    expect(useGameStore.getState().eventArmed).toBeNull();
    expect(useGameStore.getState().eventSpent).toBe(eventSpentKey(at(2026, 11, 4, 18), 'happy_hour'));
    expect(useGameStore.getState().armHouseEvent()).toBeNull();
  });

  it('does not let a dead night change the battle payout', () => {
    vi.useFakeTimers();
    vi.setSystemTime(at(2026, 11, 4, 12));
    expect(useGameStore.getState().armHouseEvent()).toBeNull();
    const paid = useGameStore.getState().recordBattleResult(false, 0, 0, 20, 1);
    expect(paid.xpGain).toBe(BATTLE_XP.loss);
    expect(paid.event).toBeNull();
  });

  it('walks the crawl from the battles it counted, once', () => {
    useGameStore.setState({ totalBattles: 3, weekBattles: 2, weekWins: 1, weekDamage: 40, weekCards: 8, coins: 0, cardPacks: 0 });
    expect(useGameStore.getState().claimBarCrawl()).toEqual({ coins: 250, packs: 1 });
    expect(useGameStore.getState().coins).toBe(250);
    expect(useGameStore.getState().cardPacks).toBe(1);
    expect(useGameStore.getState().claimBarCrawl()).toBeNull();
    expect(useGameStore.getState().crawlClaimedWeek).toBe(weekKeyOf(new Date()));
  });

  it('buys a star with the dupe price and pays the set once', () => {
    const commons = ALL_CARDS.filter((card) => card.rarity === 'common');
    const owned = commons.map((card) => card.id);
    const cost = coinsForDuplicate(commons[0].id);
    useGameStore.setState({ ownedCards: owned, coins: cost, cardPacks: 0, cardStars: {}, claimedStarSets: [] });
    const star = useGameStore.getState().raiseCardStar('common');
    expect(star).toMatchObject({ id: commons[0].id, stars: 1, cost });
    expect(useGameStore.getState().coins).toBe(0);
    expect(useGameStore.getState().raiseCardStar('common')).toBeNull();
    useGameStore.setState({
      coins: 0,
      cardStars: Object.fromEntries(owned.map((id) => [String(id), 1])),
    });
    expect(useGameStore.getState().claimStarSet('common')).toEqual({ coins: 300, packs: 1 });
    expect(useGameStore.getState().claimStarSet('common')).toBeNull();
  });

  it('pays the morning after, a level, a plaque, a chapter, and a catch-up', () => {
    vi.useFakeTimers();
    vi.setSystemTime(at(2026, 11, 7, 9));
    useGameStore.setState({
      coins: 0, cardPacks: 0, level: 10, totalWins: 8, totalBattles: 8,
      ownedCards: ALL_CARDS.slice(0, 15).map((card) => card.id),
      totalDamageDealt: 200,
      lastBattleDate: at(2026, 11, 6).toDateString(),
      firstSeenDate: at(2026, 10, 1).toDateString(),
      claimedChapters: [],
    });
    expect(useGameStore.getState().claimMorningAfter().coins).toBe(40);
    expect(useGameStore.getState().claimMorningAfter()).toBeNull();
    expect(useGameStore.getState().claimLevelReward(2)).toMatchObject({ level: 2, coins: 40 });
    expect(useGameStore.getState().claimLevelReward(2)).toBeNull();
    expect(useGameStore.getState().claimLevelReward(50)).toBeNull();
    expect(useGameStore.getState().claimPlaque('plaque_10').coins).toBe(200);
    expect(useGameStore.getState().claimPlaque('plaque_25')).toBeNull();
    expect(useGameStore.getState().claimStory('story_first_round')).toMatchObject({ id: 'story_first_round', coins: 150 });
    expect(useGameStore.getState().claimStory('story_lock_in')).toMatchObject({ id: 'story_lock_in' });
    const caught = useGameStore.getState().claimCatchUp();
    expect(caught.packs).toBe(1);
    expect(useGameStore.getState().claimCatchUp()).toBeNull();
  });

  it('adds plaque coins onto the daily, and remembers the first day', () => {
    vi.useFakeTimers();
    vi.setSystemTime(at(2026, 6, 2));
    const yesterday = at(2026, 6, 1).toDateString();
    useGameStore.setState({
      coins: 0, lastLoginDate: yesterday, consecutiveLogins: 1, claimedPlaques: ['plaque_10', 'plaque_25'],
      completedAchievements: ['daily_7'],
    });
    const paid = useGameStore.getState().checkDailyLogin();
    expect(paid.plaqueCoins).toBe(20);
    expect(useGameStore.getState().coins).toBe(75 + 20);
    expect(useGameStore.getState().firstSeenDate).toBe(at(2026, 6, 2).toDateString());
  });
});
