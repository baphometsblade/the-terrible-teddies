import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ALL_CARDS, PACK_ODDS, PACK_SLOTS, rollRarity, useGameStore } from '@/stores/gameStore';
import { NAUGHTY_LIST_CARDS, NAUGHTY_LIST_SEASON } from '@/data/naughtyList';
import { BUNDLED_SEASON_IDS } from '@/data/seasonsCatalog';
import { fromLadderId, toLadderId } from '@/data/cardRegistry';
import {
  applySeasonSnapshot, countdownMs, formatCountdown, normalizeServerSnapshot,
  resetSeasonSnapshot, seasonsForPacks, setSeasonPreview, showInAlbum, vaultOf,
  VAULT_BADGE, VAULT_LINE, visibleSeasons,
} from '@/lib/seasons';
import { rollPack, weightedPick, weightedRows } from '@/lib/packRoll';
import { bumpSeasonQuest, questReady, questsFor } from '@/lib/seasonQuests';
import { crawlFacing, crawlStatus } from '@/lib/barCrawl';
import { eventAt } from '@/lib/houseEvents';
import VaultMark from '@/components/VaultMark';
import CollectionBook from '@/components/CollectionBook';

const IDS = NAUGHTY_LIST_CARDS.map((card) => card.id);

const season = (status, extra = {}) => ({
  ...NAUGHTY_LIST_SEASON,
  status,
  ...extra,
});

const sequence = (values) => {
  let i = 0;
  return () => {
    const value = values[i % values.length];
    i += 1;
    return value;
  };
};

afterEach(() => {
  resetSeasonSnapshot();
  setSeasonPreview('');
  vi.useRealTimers();
});

describe('season clock', () => {
  it('trusts the server status and ignores the laptop clock and the row dates', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2020-01-01T00:00:00.000Z'));
    const endedDates = {
      starts_at: '2026-11-30T14:00:00.000Z',
      ends_at: '2027-01-06T13:59:00.000Z',
    };
    const active = normalizeServerSnapshot({
      server_now: '2020-01-01T00:00:00.000Z',
      seasons: [{ ...NAUGHTY_LIST_SEASON, ...endedDates, status: 'active' }],
    });
    expect(seasonsForPacks(active).map((row) => row.id)).toEqual(['naughty-list']);

    vi.setSystemTime(new Date('2030-06-01T00:00:00.000Z'));
    const closed = normalizeServerSnapshot({
      server_now: '2026-12-15T00:00:00.000Z',
      seasons: [{ ...NAUGHTY_LIST_SEASON, status: 'ended', ends_at: '2035-01-01T00:00:00.000Z' }],
    });
    expect(seasonsForPacks(closed)).toEqual([]);
    expect(vaultOf('xm-santa', closed.seasons)).toEqual({
      badge: VAULT_BADGE,
      line: VAULT_LINE,
      seasonId: 'naughty-list',
    });
  });

  it('drops a row whose status the server did not send', () => {
    const snap = normalizeServerSnapshot({
      server_now: '2026-12-15T00:00:00.000Z',
      seasons: [{ ...NAUGHTY_LIST_SEASON, status: 'live' }],
    });
    expect(snap.seasons).toEqual([]);
  });

  it('counts down from the server clock, not from Date.now', () => {
    const row = season('active');
    expect(countdownMs(row, '2026-12-31T14:00:00.000Z', 0)).toBe(
      Date.parse(NAUGHTY_LIST_SEASON.ends_at) - Date.parse('2026-12-31T14:00:00.000Z'),
    );
    expect(countdownMs(row, '2026-12-31T14:00:00.000Z', 60_000)).toBe(
      Date.parse(NAUGHTY_LIST_SEASON.ends_at) - Date.parse('2026-12-31T14:00:00.000Z') - 60_000,
    );
    expect(formatCountdown(90_000)).toBe('1m 30s');
    expect(countdownMs(row, 'not-a-date', 0)).toBeNull();
  });

  it('lets a preview dress the floor without opening packs, unless the caller allows it', () => {
    const upcoming = applySeasonSnapshot(normalizeServerSnapshot({
      server_now: '2026-11-01T00:00:00.000Z',
      seasons: [{ ...NAUGHTY_LIST_SEASON, status: 'upcoming' }],
    }));
    setSeasonPreview('naughty-list');
    const dressed = { ...upcoming, previewId: 'naughty-list' };
    expect(visibleSeasons(dressed).find((row) => row.id === 'naughty-list').status).toBe('preview');
    expect(seasonsForPacks(dressed, { allowPreview: false }).map((row) => row.id)).toEqual([]);
    expect(seasonsForPacks(dressed, { allowPreview: true }).map((row) => row.status)).toEqual(['preview']);
  });

  it('stores the Naughty List window as Brisbane local time in UTC', () => {
    expect(new Date('2026-12-01T00:00:00+10:00').toISOString()).toBe('2026-11-30T14:00:00.000Z');
    expect(new Date('2027-01-07T00:00:00+10:00').toISOString()).toBe('2027-01-06T14:00:00.000Z');
    expect(NAUGHTY_LIST_SEASON.starts_at).toBe('2026-11-30T14:00:00.000Z');
    expect(NAUGHTY_LIST_SEASON.ends_at).toBe('2027-01-06T14:00:00.000Z');
    const sql = readFileSync('supabase/migrations/20261110150000_card_seasons.sql', 'utf8');
    expect(sql).toContain("timestamp '2026-12-01 00:00:00' AT TIME ZONE 'Australia/Brisbane'");
    expect(sql).toContain("timestamp '2027-01-07 00:00:00' AT TIME ZONE 'Australia/Brisbane'");
    expect(sql).toContain('SECURITY DEFINER');
    expect(sql).not.toContain('public.card_seasons_snapshot(pg_catalog.now())');
    expect(sql).toContain('ENABLE ROW LEVEL SECURITY');
    expect(sql).toContain('GRANT SELECT ON TABLE public.card_seasons TO anon, authenticated');
    expect(sql).toContain('pg_catalog.now()');
    expect(sql).not.toMatch(/open_card_pack\s*\(\s*p_at/);
    for (const id of IDS) expect(sql).toContain(`'${id}'`);
  });
});

describe('pack weighting', () => {
  const evergreen = { id: 'plain', rarity: 'rare', name: 'Plain' };
  const seasonal = { id: 'xm-secret', rarity: 'rare', name: 'Secret Santa Stan' };
  const catalog = [evergreen, seasonal];

  it('weights an active seasonal card by the boost and drops it once the season ends', () => {
    const live = weightedRows(catalog, 'rare', [season('active', { pack_weight_boost: 3 })]);
    expect(live).toEqual([
      { card: evergreen, weight: 1 },
      { card: seasonal, weight: 3 },
    ]);
    expect(weightedRows(catalog, 'rare', [season('ended')])).toEqual([{ card: evergreen, weight: 1 }]);
    expect(weightedRows(catalog, 'rare', [])).toEqual([{ card: evergreen, weight: 1 }]);
  });

  it('picks the boosted card about three times as often', () => {
    const rows = weightedRows(catalog, 'rare', [season('active', { pack_weight_boost: 3 })]);
    let seasonalHits = 0;
    for (let i = 0; i < 400; i += 1) {
      if (weightedPick(rows, () => i / 400).id === 'xm-secret') seasonalHits += 1;
    }
    expect(seasonalHits).toBe(300);
  });

  it('uses the same weights for every pack type', () => {
    const seasons = [season('active')];
    const random = sequence([0.99, 0.5, 0.1, 0.2, 0.3, 0.4, 0.6, 0.7, 0.8, 0.15]);
    const paid = rollPack({
      catalog: ALL_CARDS, seasons, packType: 'premium', slots: PACK_SLOTS, odds: PACK_ODDS, rollRarity, random,
    });
    const earnedRandom = sequence([0.99, 0.5, 0.1, 0.2, 0.3, 0.4, 0.6, 0.7, 0.8, 0.15]);
    const earned = rollPack({
      catalog: ALL_CARDS, seasons, packType: 'regular', slots: PACK_SLOTS, odds: PACK_ODDS, rollRarity, random: earnedRandom,
    });
    // The first slot's rarity table differs. Every later slot is the standard
    // table, so the same rolls pull the same cards.
    expect(paid.slice(1).map((card) => card.id)).toEqual(earned.slice(1).map((card) => card.id));
    expect(paid.concat(earned).every((card) => !card.currency)).toBe(true);
  });

  it('keeps ended cards out of a pack the store opens, and a live boost can deal Santa', () => {
    useGameStore.setState({ cardPacks: 1, premiumPacks: 0, legendaryPacks: 0, ownedCards: [1], seasonQuest: { seasonId: '', wins: 0, cards: 0, packs: 0, claimed: [] } });
    applySeasonSnapshot({
      serverNow: '2027-02-01T00:00:00.000Z',
      seasons: [season('ended')],
      loaded: true,
      previewId: '',
    });
    const closed = useGameStore.getState().openCardPack('regular', () => 0.5);
    expect(closed.cards.some((card) => IDS.includes(card.id))).toBe(false);
    expect(useGameStore.getState().seasonQuest.packs).toBe(0);

    const rows = weightedRows(ALL_CARDS, 'legendary', [season('active', { pack_weight_boost: 3 })]);
    const santa = rows.find((row) => row.card.id === 'xm-santa');
    const before = rows.slice(0, rows.indexOf(santa)).reduce((sum, row) => sum + row.weight, 0);
    const total = rows.reduce((sum, row) => sum + row.weight, 0);
    expect(weightedPick(rows, () => (before + 0.01) / total).id).toBe('xm-santa');

    useGameStore.setState({ cardPacks: 1, ownedCards: [1] });
    applySeasonSnapshot({
      serverNow: '2026-12-15T00:00:00.000Z',
      seasons: [season('active')],
      loaded: true,
      previewId: '',
    });
    useGameStore.getState().openCardPack('regular', () => 0.5);
    expect(useGameStore.getState().seasonQuest).toMatchObject({ seasonId: 'naughty-list', packs: 1 });
  });
});

describe('vaulted cards', () => {
  it('shows the badge and the line, and still lists a copy the player owns', () => {
    const ended = [season('ended')];
    expect(showInAlbum('xm-santa', false, ended, BUNDLED_SEASON_IDS)).toBe(true);
    expect(showInAlbum('xm-santa', false, [season('upcoming')], BUNDLED_SEASON_IDS)).toBe(false);
    expect(showInAlbum('xm-santa', true, [season('upcoming')], BUNDLED_SEASON_IDS)).toBe(true);
    const html = renderToStaticMarkup(createElement(VaultMark, { cardId: 'xm-santa', seasons: ended }));
    expect(html).toContain(VAULT_BADGE);
    expect(html).toContain(VAULT_LINE);
    applySeasonSnapshot({ serverNow: '2027-02-01T00:00:00.000Z', seasons: ended, loaded: true, previewId: '' });
    const book = renderToStaticMarkup(createElement(CollectionBook));
    expect(book).toContain('The Naughty List');
    expect(book).toContain(VAULT_BADGE);
    expect(book).toContain(VAULT_LINE);
    expect(book).toContain('Sleazy Santa');
  });
});

describe('the quest line and the night', () => {
  it('moves the quests only while the server says the season is active', () => {
    const active = season('active');
    const progress = bumpSeasonQuest(null, active, { wins: 1, cards: 8, packs: 1 });
    expect(progress.wins).toBe(1);
    const quest = questsFor('naughty-list')[0];
    expect(questReady(quest, progress)).toBe(true);
    expect(bumpSeasonQuest(progress, season('ended'), { wins: 5 })).toMatchObject({ wins: 1 });
    expect(eventAt(new Date('2026-11-07T18:00:00'), [active]).id).toBe('naughty_list');
    expect(eventAt(new Date('2026-11-07T18:00:00'), [season('ended')]).id).toBe('stag_do');
  });

  it('dresses the crawl without changing its reward', () => {
    const plain = crawlStatus({ totalBattles: 3, weekBattles: 1, weekWins: 1, weekDamage: 40, weekCards: 8 }, 'week');
    const dressed = crawlFacing(plain, season('active'));
    expect(dressed.title).toBe('Office-party crawl');
    expect(dressed.reward).toEqual(plain.reward);
    expect(dressed.stops.find((stop) => stop.id === 'song').line).toMatch(/carols/);
    expect(dressed.stops.map((stop) => stop.met)).toEqual(plain.stops.map((stop) => stop.met));
  });
});

describe('the card registry', () => {
  it('files the Naughty List through the same door as the other waves', () => {
    for (const card of NAUGHTY_LIST_CARDS) {
      expect(card.ladderId).toBeGreaterThanOrEqual(181);
      expect(card.ladderId).toBeLessThanOrEqual(190);
      expect(toLadderId(card.id)).toBe(card.ladderId);
      expect(fromLadderId(card.ladderId)).toBe(card.id);
    }
    expect(fromLadderId(200)).toBe('hd-luxe');
    expect(toLadderId(4)).toBe(4);
  });
});
