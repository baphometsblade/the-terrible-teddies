import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest';
import { useGameStore, coinsForDuplicate, BATTLE_XP } from './gameStore';
import { BATTLE_PASS_REWARDS, readyRewards } from '@/lib/battlePass';
import { getCurrentSeason, getSeason } from '@/utils/season';

// The Battle Pass's money paths in the store: a claim and what it really
// hands over, and a season's end, which used to wipe every reached-but-
// unclaimed tier and every cosmetic the pass had sold, without a word.

const get = () => useGameStore.getState();
const row = (tier) => BATTLE_PASS_REWARDS.find((r) => r.tier === tier);
const firstOf = (track, type) => BATTLE_PASS_REWARDS.find((r) => r[track]?.type === type);
const allTiers = BATTLE_PASS_REWARDS.map((r) => r.tier);

beforeEach(() => {
  localStorage.clear();
  get().resetProgress();
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-11-02T12:00:00Z')); // Season 3
  useGameStore.setState({ seasonKey: getCurrentSeason().key, animationsEnabled: false });
});

afterEach(() => {
  vi.useRealTimers();
});

describe('claimBattlePassTier', () => {
  it('hands a new card over and says it is new', () => {
    const { tier, premium } = firstOf('premium', 'card');
    useGameStore.setState({ seasonXP: row(tier).xpRequired, hasBattlePassPremium: true, ownedCards: [1], coins: 0 });
    const out = get().claimBattlePassTier(tier, 'premium');
    expect(out).toMatchObject({ ok: true, card: { id: premium.cardId, name: premium.name } });
    expect(out.alreadyOwned).toBeUndefined();
    expect(get().ownedCards).toContain(premium.cardId);
    expect(get().coins).toBe(0);
  });

  // The pass toasted "Card Unlocked! You got Peeping Pete!" to a player who
  // already owned him, and paid the duplicate coins in silence.
  it('says a card already owned was paid as its duplicate coins', () => {
    const { tier, premium } = firstOf('premium', 'card');
    useGameStore.setState({ seasonXP: row(tier).xpRequired, hasBattlePassPremium: true, ownedCards: [1, premium.cardId], coins: 0 });
    const out = get().claimBattlePassTier(tier, 'premium');
    expect(out).toMatchObject({ ok: true, alreadyOwned: true, coins: coinsForDuplicate(premium.cardId) });
    expect(out.coins).toBeGreaterThan(0);
    expect(get().coins).toBe(out.coins);
    expect(get().ownedCards.filter((id) => id === premium.cardId)).toHaveLength(1);
  });

  it('grants each kind of reward from the table, once', () => {
    useGameStore.setState({ seasonXP: 1e9, hasBattlePassPremium: true, coins: 0, gems: 0, cardPacks: 0, unlockedCosmetics: [] });
    const coins = firstOf('free', 'coins');
    const gems = firstOf('free', 'gems');
    const pack = firstOf('free', 'pack');
    const border = firstOf('premium', 'exclusive');
    expect(get().claimBattlePassTier(coins.tier, 'free')).toMatchObject({ ok: true, coins: coins.free.amount });
    expect(get().claimBattlePassTier(gems.tier, 'free')).toMatchObject({ ok: true, gems: gems.free.amount });
    expect(get().claimBattlePassTier(pack.tier, 'free')).toMatchObject({ ok: true, packs: pack.free.amount });
    expect(get().claimBattlePassTier(border.tier, 'premium')).toMatchObject({ ok: true, cosmetic: border.premium.name });
    expect(get()).toMatchObject({ coins: coins.free.amount, gems: gems.free.amount, cardPacks: pack.free.amount });
    expect(get().unlockedCosmetics).toEqual([border.premium.name]);
    // A second tap pays nothing.
    expect(get().claimBattlePassTier(coins.tier, 'free')).toEqual({ ok: false, reason: 'already-claimed' });
    expect(get().coins).toBe(coins.free.amount);
  });

  it('says a cosmetic already owned is not granted twice', () => {
    const border = firstOf('premium', 'exclusive');
    useGameStore.setState({ seasonXP: 1e9, hasBattlePassPremium: true, unlockedCosmetics: [border.premium.name] });
    expect(get().claimBattlePassTier(border.tier, 'premium')).toMatchObject({ ok: true, alreadyOwned: true });
    expect(get().unlockedCosmetics).toEqual([border.premium.name]);
  });

  it('checks eligibility itself, from the table', () => {
    useGameStore.setState({ seasonXP: row(2).xpRequired - 1, hasBattlePassPremium: false, coins: 0 });
    expect(get().claimBattlePassTier(2, 'free')).toEqual({ ok: false, reason: 'not-reached' });
    expect(get().claimBattlePassTier(1, 'premium')).toEqual({ ok: false, reason: 'needs-premium' });
    expect(get().claimBattlePassTier(99, 'free')).toEqual({ ok: false, reason: 'unknown' });
    expect(get().coins).toBe(0);
    expect(get().claimedBattlePassRewards).toEqual({ free: [], premium: [] });
  });
});

describe('a season ending', () => {
  const lastSeason = () => getSeason(getCurrentSeason().number - 1);
  // A save from last season, reached to `xp`, with some tiles claimed.
  const endedSave = (patch) => useGameStore.setState({
    seasonKey: lastSeason().key,
    coins: 0, gems: 0, cardPacks: 0, ownedCards: [1], unlockedCosmetics: [],
    ...patch,
  });

  it('delivers every reached, unclaimed tile, free and (with the pass) premium, then resets the pass', () => {
    const xp = row(6).xpRequired;
    endedSave({ seasonXP: xp, hasBattlePassPremium: true, claimedBattlePassRewards: { free: [1], premium: [2] } });
    const owed = readyRewards({ seasonXP: xp, claimed: { free: [1], premium: [2] }, hasPremium: true });
    const sum = (type) => owed.filter((o) => o.reward.type === type).reduce((n, o) => n + o.reward.amount, 0);

    const delivery = get().syncSeason();

    expect(delivery.receipts.map(({ tier, track }) => [tier, track])).toEqual(owed.map(({ tier, track }) => [tier, track]));
    expect(get().coins).toBe(sum('coins'));
    expect(get().gems).toBe(sum('gems'));
    expect(get().cardPacks).toBe(sum('pack'));
    for (const o of owed.filter((x) => x.reward.type === 'card')) expect(get().ownedCards).toContain(o.reward.cardId);
    for (const o of owed.filter((x) => x.reward.type === 'exclusive')) expect(get().unlockedCosmetics).toContain(o.reward.name);
    // Nothing past the tier reached.
    const beyond = BATTLE_PASS_REWARDS.find((r) => r.xpRequired > xp && r.premium.type === 'card');
    expect(get().ownedCards).not.toContain(beyond.premium.cardId);
    // And the pass starts over.
    expect(get()).toMatchObject({
      seasonKey: getCurrentSeason().key, seasonXP: 0, hasBattlePassPremium: false,
      claimedBattlePassRewards: { free: [], premium: [] },
    });
  });

  it('queues one notice naming the season and what it delivered', () => {
    endedSave({ seasonXP: row(2).xpRequired, hasBattlePassPremium: false, claimedBattlePassRewards: { free: [], premium: [] } });
    get().syncSeason();
    const [notice, ...more] = get().pendingSeasonDeliveries;
    expect(more).toEqual([]);
    expect(notice.season).toBe(lastSeason().name);
    expect(notice.summary).toBe(`+${row(1).free.amount} coins and ${row(2).free.amount} card pack`);
    get().dismissSeasonDelivery(notice.id);
    expect(get().pendingSeasonDeliveries).toEqual([]);
  });

  it('delivers the premium track only to a pass holder', () => {
    endedSave({ seasonXP: 1e9, hasBattlePassPremium: false, claimedBattlePassRewards: { free: allTiers, premium: [] } });
    expect(get().syncSeason()).toBeNull();
    expect(get().coins + get().gems + get().cardPacks).toBe(0);
    expect(get().pendingSeasonDeliveries).toEqual([]);
  });

  // StrictMode runs every effect twice, and the menu, the pass and Card
  // Packs each roll the season on mount: only the first call may deliver.
  it('delivers once however many times it is called', () => {
    endedSave({ seasonXP: row(4).xpRequired, hasBattlePassPremium: true, claimedBattlePassRewards: { free: [], premium: [] } });
    const first = get().syncSeason();
    const after = { coins: get().coins, gems: get().gems, cardPacks: get().cardPacks, ownedCards: get().ownedCards };
    expect(first.receipts.length).toBeGreaterThan(0);
    expect(get().syncSeason()).toBeNull();
    expect(get().syncSeason()).toBeNull();
    expect({ coins: get().coins, gems: get().gems, cardPacks: get().cardPacks, ownedCards: get().ownedCards }).toEqual(after);
    expect(get().pendingSeasonDeliveries).toHaveLength(1);
  });

  // The save only ever holds the pass it was last played in, so a player
  // back after a year gets that season's tiles once, not once per season.
  it('delivers a player who skipped seasons the one season they played, once', () => {
    vi.setSystemTime(new Date('2027-08-15T12:00:00Z')); // Season 6
    useGameStore.setState({
      seasonKey: 'season-2', seasonXP: row(3).xpRequired, hasBattlePassPremium: false,
      claimedBattlePassRewards: { free: [1], premium: [] }, coins: 0, gems: 0, cardPacks: 0,
    });
    const delivery = get().syncSeason();
    expect(delivery.season).toBe(getSeason(2).name);
    expect(delivery.receipts.map((r) => r.tier)).toEqual([2, 3]);
    expect(get().cardPacks).toBe(row(2).free.amount);
    expect(get().coins).toBe(row(3).free.amount);
    expect(get().seasonKey).toBe('season-6');
    expect(get().syncSeason()).toBeNull();
    expect(get().pendingSeasonDeliveries).toHaveLength(1);
  });

  it('pays a delivered card the player already owns as its duplicate coins, and says so', () => {
    const { tier, premium } = firstOf('premium', 'card');
    endedSave({
      seasonXP: row(tier).xpRequired, hasBattlePassPremium: true, ownedCards: [1, premium.cardId],
      claimedBattlePassRewards: { free: allTiers, premium: allTiers.filter((t) => t !== tier) },
    });
    const delivery = get().syncSeason();
    expect(delivery.receipts).toEqual([expect.objectContaining({ tier, alreadyOwned: true, coins: coinsForDuplicate(premium.cardId) })]);
    expect(delivery.summary).toBe(`+${coinsForDuplicate(premium.cardId)} coins`);
    expect(get().coins).toBe(coinsForDuplicate(premium.cardId));
  });

  // Lead decision: what the pass unlocked is the player's to keep. The
  // rollover used to clear unlockedCosmetics with the pass.
  it('keeps the cosmetics the pass unlocked', () => {
    endedSave({ seasonXP: 0, unlockedCosmetics: ['Gold Border', 'Teddy Emote'], claimedBattlePassRewards: { free: [1], premium: [] } });
    get().syncSeason();
    expect(get().seasonKey).toBe(getCurrentSeason().key);
    expect(get().unlockedCosmetics).toEqual(['Gold Border', 'Teddy Emote']);
  });

  it('delivers a pre-rollover save’s Season 1 progress when it is first loaded in a later season', () => {
    useGameStore.setState({
      seasonKey: null, seasonXP: row(2).xpRequired, hasBattlePassPremium: false,
      claimedBattlePassRewards: { free: [1], premium: [] }, cardPacks: 0,
    });
    const delivery = get().syncSeason();
    expect(delivery.season).toBe(getSeason(1).name);
    expect(get().cardPacks).toBe(row(2).free.amount);
  });

  it('does not persist the notice: it is announced in the session that delivered it', () => {
    endedSave({ seasonXP: row(2).xpRequired, claimedBattlePassRewards: { free: [], premium: [] } });
    get().syncSeason();
    expect(get().pendingSeasonDeliveries).toHaveLength(1);
    const saved = JSON.parse(localStorage.getItem('terrible-teddies-storage'));
    expect(saved.state).not.toHaveProperty('pendingSeasonDeliveries');
  });
});

describe('BATTLE_XP', () => {
  // The Battle Pass footer says what a battle pays from this; it must be
  // what recordBattleResult really pays.
  it('is what a battle pays in season XP, win or lose', () => {
    useGameStore.setState({ seasonXP: 0 });
    get().recordBattleResult(true);
    expect(get().seasonXP).toBe(BATTLE_XP.win);
    get().recordBattleResult(false);
    expect(get().seasonXP).toBe(BATTLE_XP.win + BATTLE_XP.loss);
  });
});
