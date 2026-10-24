import { create } from 'zustand';
import {
  useGameStore, normalizeSave, getXPForLevel, keptThroughReset, STARTING_GEMS, BATTLE_XP, scratchGameStore,
} from '@/stores/gameStore';
import {
  CLOUD_FIELDS, cloudPayload, saveHash, hasUnsyncedChanges, pick, isSaveObject,
  readJSON, writeJSON, seenHashes, remember, newLineage,
} from './saveBinding';
import { getPlayerSave, putPlayerSave, putPlayerSaveKeepalive } from '@/utils/supabaseClient';
import { toast } from '@/components/ui/use-toast';

/**
 * The account's save, kept on the server (player_saves, through
 * get_player_save / put_player_save; see
 * supabase/migrations/20261023000000_cloud_saves_and_rank.sql).
 *
 * The game still plays entirely from the local store, which persists to
 * localStorage as before. This module keeps a copy of it on the account:
 *
 *  - At sign-in (after bindToUser, before the gem reconcile) it reads the
 *    server's save and decides, by the rules in decideSync, whether this
 *    device sends its save, takes the server's, or, when both have moved,
 *    keeps the one with more progress and puts the other aside as a backup
 *    the player can switch to (Settings). It says what it did in a toast.
 *  - After that it sends the save a few seconds after the last change, and
 *    at once when the tab is hidden or the page goes away (a keepalive
 *    request, which the browser finishes after the page has gone).
 *  - Every write is a compare-and-swap on the server's rev, so a device that
 *    is behind never overwrites another's progress: it is refused, re-reads,
 *    and decides again.
 *  - A backend without the migration yet (the functions are missing, or
 *    answer something else) turns it off for the session and changes
 *    nothing: the game is exactly as local-only as it was before.
 *
 * Gems: the reconcile credits the server's purchase total above the save's
 * lastSyncedServerGems mark. That mark travels inside the save, so a save
 * taken from the server brings the mark that matches its own gems: a fresh
 * device no longer re-credits every gem the account ever bought (its mark used
 * to be 0), and a purchase the server save has not counted yet is still
 * credited on top. App runs the reconcile from onSettled, after each decision.
 */

// What travels and its fingerprint, the seen-save lineage and binding the
// store to an account live in ./saveBinding.js, which the boot path needs.
export { CLOUD_FIELDS, cloudPayload, saveHash, hasUnsyncedChanges, seenHashes, bindSaveToUser } from './saveBinding';

// The server refuses a save over 64 KiB of its JSON text, which Postgres
// prints with a space after every colon and comma; this is the compact JSON
// the client sends, with room for that difference. A real save is a few KiB.
export const CLOUD_SAVE_MAX_BYTES = 48 * 1024;
const byteSize = (payload) => new TextEncoder().encode(JSON.stringify(payload)).length;

// ---------------------------------------------------------------------------
// Progress, and the save with none
// ---------------------------------------------------------------------------

// A card counts as much as a won battle's XP: roughly what a pack's worth of
// coins takes to earn.
export const CARD_PROGRESS = BATTLE_XP.win;

/**
 * How far a save has played, as one number that only ever goes up in play:
 * lifetime XP (XP is never taken away; a level-up only moves it between
 * `level` and `xp`), plus CARD_PROGRESS for each different card owned (cards
 * are never removed), plus one per battle played (battles only count up).
 * Only a reset makes it smaller. When two devices have both moved on, the
 * one with more of this is kept.
 */
export const progressOf = (save) => {
  // Capped so that a corrupt level cannot spin this loop: past level 200 the
  // XP each level takes is far beyond any real save anyway.
  const level = Math.min(200, Math.max(1, Math.floor(Number(save?.level) || 1)));
  let xp = Math.max(0, Number(save?.xp) || 0);
  for (let l = 1; l < level; l += 1) xp += getXPForLevel(l);
  const cards = new Set(Array.isArray(save?.ownedCards) ? save.ownedCards : []).size;
  const battles = Math.max(0, Math.floor(Number(save?.totalBattles) || 0));
  return xp + cards * CARD_PROGRESS + battles;
};

const FRESH_PROGRESS = progressOf(normalizeSave({}));

/**
 * Whether a save holds anything a reset keeps beyond what a new save starts
 * with (keptThroughReset): gems above the starting ones, unopened Premium or
 * Legendary packs, a running Coin Doubler, cosmetics, this season's Premium
 * Pass. A wiped save can still hold these, and they were paid for, so it is
 * never thrown away as if it were empty.
 */
export const holdsPaidItems = (save, now = new Date()) => {
  const kept = keptThroughReset(normalizeSave(save), now);
  return kept.gems > STARTING_GEMS
    || kept.premiumPacks > 0
    || kept.legendaryPacks > 0
    || kept.coinDoublerExpiresAt !== null
    || kept.unlockedCosmetics.length > 0
    || kept.hasBattlePassPremium === true;
};

/** A save with nothing in it: no progress past a new one, and nothing paid for. */
export const isFreshSave = (save, now = new Date()) =>
  progressOf(save) <= FRESH_PROGRESS && !holdsPaidItems(save, now);

// ---------------------------------------------------------------------------
// The calendar's own changes
// ---------------------------------------------------------------------------

/**
 * A save as the calendar leaves it today: a new day's and a new week's
 * challenge counters, a new season's pass (and the tiers it owed, delivered).
 * The menu writes exactly this on the first open of each day (MainMenu's
 * syncSeason, then syncPeriods), before any decision can have read the
 * account's save, so a device that has done nothing since its last sync no
 * longer holds the save it synced. That is not the player's change, and it
 * must not make a device that is only behind look like one that moved on:
 * it was told "Two saves didn't match", and on a progress tie sent its old
 * save over the account's. Run by the store's own actions on a scratch copy
 * (scratchGameStore), so it cannot drift from them. `steps`: the menu runs
 * both; a screen opened later may have run only one (Challenges rolls the
 * day, the Battle Pass the season), which ROLLOVERS covers.
 */
export const rollForward = (payload, steps = ['syncSeason', 'syncPeriods']) => {
  const scratch = scratchGameStore(payload);
  for (const step of steps) scratch.getState()[step]();
  return cloudPayload(scratch.getState());
};
const ROLLOVERS = [['syncSeason', 'syncPeriods'], ['syncPeriods'], ['syncSeason']];

// Bring the save just put in the store (the account's, or the backup) up to
// today, as rollForward does: the menu's own rollovers ran on the save it
// replaced, and will not run again until it remounts. Yesterday's counters
// then badged today's challenges as finished until Challenges was opened and
// zeroed them. An ordinary change, so it reaches the account like any other.
const rollStoreForward = () => {
  useGameStore.getState().syncSeason();
  useGameStore.getState().syncPeriods();
};

// The save as this device last synced it, per account, newest only: what
// rule 4 rolls forward. Kept beside the game save rather than in it, so the
// save written on every change does not carry a second copy of itself; it is
// only believed while its fingerprint is the store's cloudSyncedHash, so a
// record another tab or account left behind is never mistaken for this one.
const syncedKey = (uid) => `terrible-teddies-cloud-synced:${uid}`;
const recordSynced = (uid, hash, payload) => writeJSON(syncedKey(uid), { hash, save: payload });
export const lastSyncedSave = (uid, hash) => {
  const r = uid && hash ? readJSON(syncedKey(uid)) : null;
  return r && r.hash === hash && isSaveObject(r.save) && saveHash(r.save) === hash ? r.save : null;
};

// ---------------------------------------------------------------------------
// The decision
// ---------------------------------------------------------------------------

/**
 * What to do with this device's save and the account's, in order:
 *
 *  1. The account has no save yet: send this one (base rev 0).
 *  2. The two are the same save: note that they are in step.
 *  3. The account's save is one this device already has (the one it last
 *     synced at that rev, or one it sent or took since): this device's save
 *     is that plus more, so send it.
 *  4. This device has not changed since its last sync, and the account has:
 *     take the account's. The calendar's own changes (rollForward) do not
 *     count as a change here.
 *  5. This device's save was never synced and holds nothing (a new device,
 *     or a save just wiped for this account): take the account's.
 *  6. Both have changed: keep the one with more progress (this device's on a
 *     tie), and keep the other as a backup.
 *
 * `local`: { hash, syncedHash, rev, progress, fresh, rolledHashes } — `fresh`
 * is rule 5's test (never synced and isFreshSave); `rolledHashes` are the
 * fingerprints of the last synced save rolled forward to today (rollForward;
 * empty when that save is not known). `server`: { rev, hash, progress }, hash
 * null when there is no save. `seen`: fingerprints this device has sent or
 * taken for this account.
 *
 * @returns {{action: 'push'|'in-sync'|'adopt', baseRev?: number, backup?: 'local'|'server', rule: number}}
 */
export const decideSync = ({ local, server, seen = new Set() }) => {
  if (server.hash === null) return { action: 'push', baseRev: 0, rule: 1 };
  if (local.hash === server.hash) return { action: 'in-sync', baseRev: server.rev, rule: 2 };
  const serverIsOurs = (server.rev === local.rev && server.hash === local.syncedHash) || seen.has(server.hash);
  if (serverIsOurs) return { action: 'push', baseRev: server.rev, rule: 3 };
  const untouched = local.hash === local.syncedHash || (local.rolledHashes ?? []).includes(local.hash);
  if (local.syncedHash !== null && untouched) return { action: 'adopt', rule: 4 };
  if (local.fresh) return { action: 'adopt', rule: 5 };
  if (local.progress >= server.progress) return { action: 'push', baseRev: server.rev, backup: 'server', rule: 6 };
  return { action: 'adopt', backup: 'local', rule: 6 };
};

// ---------------------------------------------------------------------------
// What a response means
// ---------------------------------------------------------------------------

const toMs = (iso) => {
  const t = Date.parse(iso);
  return Number.isFinite(t) ? t : null;
};

const validGet = (d) => (
  isSaveObject(d) && Number.isSafeInteger(d.rev) && d.rev >= 0
    && (d.save === null || isSaveObject(d.save)) && (d.rev === 0) === (d.save === null)
    ? { rev: d.rev, save: d.save, updatedAt: toMs(d.updated_at) }
    : null
);

const validPut = (d) => (
  isSaveObject(d) && typeof d.ok === 'boolean' && Number.isSafeInteger(d.rev) && d.rev >= 0
    ? { ok: d.ok, rev: d.rev, updatedAt: toMs(d.updated_at) }
    : null
);

/**
 * supabase-js's { data, error, status } as one of:
 *   ok          — the function answered as the migration defines it
 *   unavailable — the function is not there (PostgREST's 404 / PGRST202), the
 *                 signed-in user's role may not call it, or it answered
 *                 something else: this backend has no cloud saves, and
 *                 asking again will not help
 *   too-large   — the server's size cap (PT413, HTTP 413)
 *   error       — anything else (offline, a 5xx, an expired token, no
 *                 session to send with): try again
 *
 * insufficient_privilege (42501) means "no cloud saves here" only when it
 * refuses the user's own token, which PostgREST answers with 403. With 401
 * it is the anon role being refused: the request went without a usable
 * session, which a later one will have.
 */
export const classifyRpc = (raw, validate) => {
  const { data, error, status } = raw || {};
  if (error) {
    const code = String(error.code || '');
    if (code === 'PT413' || status === 413) return { kind: 'too-large' };
    if (status === 404 || ['PGRST202', 'PGRST205', '42883', '42P01'].includes(code)) return { kind: 'unavailable' };
    if (code === '42501') return { kind: status === 401 ? 'error' : 'unavailable' };
    return { kind: 'error' };
  }
  const valid = validate(data);
  return valid ? { kind: 'ok', ...valid } : { kind: 'unavailable' };
};

// ---------------------------------------------------------------------------
// The backup (the localStorage helpers and the seen lineage: saveBinding.js)
// ---------------------------------------------------------------------------

// The other save, when two did not match (rule 6): one per account, the
// newest, on this device only. Switching to it swaps the two, so the save
// it replaces becomes the backup and nothing is ever dropped by the switch.
export const backupKey = (uid) => `terrible-teddies-backup:${uid}`;

export const readBackup = (uid) => {
  const b = uid ? readJSON(backupKey(uid)) : null;
  return b && isSaveObject(b.save) ? b : null;
};
const writeBackup = (uid, payload, now = Date.now()) => {
  writeJSON(backupKey(uid), {
    savedAt: now,
    level: Number(payload.level) || 1,
    cards: new Set(Array.isArray(payload.ownedCards) ? payload.ownedCards : []).size,
    save: payload,
  });
};

// ---------------------------------------------------------------------------
// Status, for Settings
// ---------------------------------------------------------------------------

/**
 * phase: 'off' (no account), 'checking' (reading the account's save),
 * 'pending' (a change waiting its few seconds), 'saving', 'saved',
 * 'offline' (a request failed; it will retry), 'unavailable' (this backend has
 * no cloud saves), 'too-large'. savedAt: when the account last got this save
 * (epoch ms). backup: the other save's summary, or null.
 */
export const useCloudSave = create(() => ({ phase: 'off', savedAt: null, backup: null }));
const setStatus = (patch) => useCloudSave.setState(patch);

/** A moment as Settings says it: the time today, the date and time before. */
export const formatSavedAt = (ms, now = new Date()) => {
  const at = new Date(ms);
  const time = at.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  if (at.toDateString() === now.toDateString()) return time;
  return `${at.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}, ${time}`;
};

/**
 * Where the save is, in words, for each phase. Every line is only what is
 * true at that moment: "Saved to your account" only once the account has
 * this save, and "Saved on this device only" when the backend has no cloud
 * saves to keep it in.
 */
export const describeSaveStatus = ({ phase, savedAt }, now = new Date()) => {
  switch (phase) {
    case 'saved':
      return savedAt ? `Saved to your account · ${formatSavedAt(savedAt, now)}` : 'Saved to your account';
    case 'pending':
    case 'saving':
      return 'Saving…';
    case 'checking':
      return 'Checking your account…';
    case 'offline':
      return 'Couldn’t reach the server — saved on this device, will retry';
    case 'too-large':
      return 'Saved on this device only — too large to keep on your account';
    case 'unavailable':
      return 'Saved on this device only';
    default:
      return 'Saved on this device';
  }
};

const backupSummary = (uid) => {
  const b = readBackup(uid);
  return b ? { savedAt: b.savedAt, level: b.level, cards: b.cards } : null;
};

// ---------------------------------------------------------------------------
// The controller
// ---------------------------------------------------------------------------

/** How long after the last change the save is sent. */
export const PUSH_DEBOUNCE_MS = 3000;
/** The first retry after a failure; each next one doubles, up to the max. */
export const RETRY_BASE_MS = 2000;
export const RETRY_MAX_MS = 60_000;
/** A return to the tab re-reads the account's save at most this often. */
export const RECHECK_MIN_MS = 15_000;
// Refusals in a row before backing off: two devices racing each other.
const MAX_CONFLICTS = 3;

let ctx = null;
// True while this module writes the store itself, so its own writes are not
// mistaken for the player's changes.
let applyingRemote = false;

const hidden = () => typeof document !== 'undefined' && document.visibilityState === 'hidden';

/**
 * Whether a battle is in play: GameBoard marks <html data-screen="battle">
 * until the game is over. The battle lives in GameBoard's state, not the
 * store, so mid-battle the save does not change; its result is one store
 * write at the end. Two things wait for that write. A decision, which could
 * swap the save under the board, waits until the battle is over. And the
 * flush when the tab is hidden or the page goes: if the page is going away,
 * GameBoard's own pagehide listener (registered after ours) books the
 * abandoned battle as a loss a moment later, and that write is sent by itself
 * (see onStoreChange). Sent first, the save without the loss would hold the
 * rev, and the save with it, carrying the same base, could only be refused.
 *
 * A reload or a close fires pagehide while the tab is still visible, and only
 * then hides it, so "is the page going" is its own flag (`unloading`), not
 * the visibility: keyed on visibility alone, the loss written in between was
 * left to a three-second wait that never ran, and never reached the account.
 */
export const battleInPlay = () =>
  typeof document !== 'undefined' && document.documentElement?.dataset?.screen === 'battle';

const quietly = (fn) => {
  applyingRemote = true;
  try {
    return fn();
  } finally {
    applyingRemote = false;
  }
};

// Re-read the save from localStorage, so a decision is made on what this
// device holds now, including what another tab wrote (useRehydrateOnFocus
// does the same on every return to the tab). With localStorage the read is
// synchronous; the promise only signals the end.
const rehydrate = () => {
  const p = quietly(() => useGameStore.persist?.rehydrate?.());
  return Promise.resolve(p).catch(() => {});
};

const enqueue = (c, task) => {
  const job = c.queue.then(() => (c === ctx ? task() : 'stale'));
  c.queue = job.catch((err) => {
    console.error('Cloud save failed:', err);
  });
  return job.catch(() => 'error');
};

// A re-read of the account's save, unless one is already waiting its turn
// (a return to the tab brings a session change too).
const enqueueDecision = (c, trigger) => {
  if (c.decisionQueued) return c.decisionQueued;
  c.decisionQueued = enqueue(c, () => {
    c.decisionQueued = null;
    return decide(c, trigger);
  });
  return c.decisionQueued;
};

const settle = (c, outcome) => {
  try {
    c.onSettled?.(outcome);
  } catch (err) {
    console.error('Cloud save settle handler failed:', err);
  }
};

const resetRetry = (c) => {
  clearTimeout(c.retry);
  c.retry = null;
  c.retryDelay = 0;
};

const retryLater = (c, kind) => {
  c.retryDelay = Math.min(RETRY_MAX_MS, c.retryDelay ? c.retryDelay * 2 : RETRY_BASE_MS);
  // A little jitter, so two devices that failed together do not retry together.
  const wait = Math.round(c.retryDelay * (0.8 + Math.random() * 0.4));
  if (kind === 'decide') c.wantDecision = true;
  clearTimeout(c.retry);
  c.retry = setTimeout(() => {
    c.retry = null;
    enqueue(c, () => run(c, 'retry'));
  }, wait);
  setStatus({ phase: 'offline' });
  return 'offline';
};

const markUnavailable = (c, phase = 'unavailable') => {
  c.available = false;
  clearTimeout(c.debounce);
  resetRetry(c);
  setStatus({ phase });
  settle(c, phase);
  return phase;
};

// Note what the server holds now (`payload`, at `rev`), on the store. In a
// hidden tab the store is re-read from localStorage first: a hidden tab's
// copy can be older than what the tab in front has written, and setState
// writes the whole save back.
const commitMeta = (c, rev, hash, payload, at) => {
  if (hidden()) quietly(() => useGameStore.persist?.rehydrate?.());
  const s = useGameStore.getState();
  if (s.ownerUserId !== c.uid) return;
  recordSynced(c.uid, hash, payload);
  quietly(() => useGameStore.setState({ cloudRev: rev, cloudSyncedHash: hash, cloudSyncedAt: at ?? Date.now() }));
};

const summarise = (save) => {
  const cards = new Set(Array.isArray(save?.ownedCards) ? save.ownedCards : []).size;
  return `Level ${Number(save?.level) || 1}, ${cards} cards`;
};

// Replace the store's save with the account's.
const adopt = (c, server) => {
  const next = normalizeSave(server.payload);
  quietly(() => useGameStore.setState({
    ...pick(next, CLOUD_FIELDS),
    ownerUserId: c.uid,
    cloudRev: server.rev,
    cloudSyncedHash: server.hash,
    cloudSyncedAt: server.updatedAt ?? Date.now(),
    // Announcements about the save being replaced.
    pendingAchievements: [],
    pendingLevelUps: [],
    pendingSeasonDeliveries: [],
  }));
  recordSynced(c.uid, server.hash, server.payload);
  newLineage(c.uid, [server.hash]);
};

const describeServer = (res) => {
  if (res.save === null) return { rev: res.rev, hash: null, progress: 0, payload: null, updatedAt: null };
  const payload = cloudPayload(normalizeSave(res.save));
  return { rev: res.rev, hash: saveHash(payload), progress: progressOf(payload), payload, updatedAt: res.updatedAt };
};

const describeLocal = (state, payload) => {
  const synced = lastSyncedSave(state.ownerUserId, state.cloudSyncedHash);
  return {
    hash: saveHash(payload),
    syncedHash: state.cloudSyncedHash,
    rev: state.cloudRev,
    progress: progressOf(payload),
    fresh: state.cloudSyncedHash === null && isFreshSave(payload),
    rolledHashes: synced ? ROLLOVERS.map((steps) => saveHash(rollForward(synced, steps))) : [],
  };
};

// Send the store's save from `base` (default: the rev it is in step with).
// `inner`: sent by a decision, which settles once for the both of them.
async function push(c, { base = null, conflicts = 0, inner = false } = {}) {
  if (hidden()) {
    flush('hidden');
    return 'flushed';
  }
  // A keepalive write still out carries the same base; wait for its answer.
  if (c.flushing) await c.flushing;
  if (c !== ctx || !c.available) return 'stale';
  const state = useGameStore.getState();
  if (state.ownerUserId !== c.uid) return 'stale';
  const payload = cloudPayload(state);
  const hash = saveHash(payload);
  if (base === null && hash === state.cloudSyncedHash) {
    setStatus({ phase: 'saved', savedAt: state.cloudSyncedAt });
    return 'clean';
  }
  if (byteSize(payload) > CLOUD_SAVE_MAX_BYTES) return markUnavailable(c, 'too-large');

  // Before sending, not after: if the answer is lost, this device still knows
  // the server may hold this save, and that its own save contains it.
  remember(c.uid, hash);
  setStatus({ phase: 'saving' });
  c.pushing = true;
  let res;
  try {
    res = classifyRpc(await putPlayerSave(payload, base ?? state.cloudRev), validPut);
  } finally {
    c.pushing = false;
  }
  if (c !== ctx) return 'stale';

  if (res.kind === 'ok' && res.ok) {
    commitMeta(c, res.rev, hash, payload, res.updatedAt);
    resetRetry(c);
    const now = useGameStore.getState();
    const dirty = hasUnsyncedChanges(now);
    setStatus({ phase: dirty ? 'pending' : 'saved', savedAt: res.updatedAt ?? Date.now() });
    // Changed while this was out: the tab in front has a send scheduled
    // already (onStoreChange); a tab that went away meanwhile sends now.
    if (dirty && hidden()) flush('hidden');
    return 'pushed';
  }
  if (res.kind === 'ok') {
    // Refused: the account's save moved on. Read it and decide again.
    if (conflicts + 1 >= MAX_CONFLICTS) return retryLater(c, 'decide');
    return decide(c, 'conflict', conflicts + 1, inner);
  }
  if (res.kind === 'unavailable') return markUnavailable(c);
  if (res.kind === 'too-large') return markUnavailable(c, 'too-large');
  return retryLater(c, 'push');
}

// Read the account's save and act on decideSync's verdict. Settles (App's
// gem reconcile) when done, unless `inner`: re-run by a refused write that a
// decision sent, whose own settle follows.
async function decide(c, trigger, conflicts = 0, inner = false) {
  if (!c.available) return 'unavailable';
  // Only a tab in front swaps the save, and never under a battle. The next
  // return to the tab, or the battle's result, picks this up.
  if (hidden() || battleInPlay()) {
    c.wantDecision = true;
    return 'deferred';
  }
  c.wantDecision = false;
  c.lastCheck = Date.now();
  clearTimeout(c.debounce);
  c.debounce = null;
  setStatus({ phase: 'checking' });

  await rehydrate();
  const res = classifyRpc(await getPlayerSave(), validGet);
  if (c !== ctx) return 'stale';
  if (res.kind === 'unavailable') return markUnavailable(c);
  if (res.kind !== 'ok') return retryLater(c, 'decide');
  if (hidden() || battleInPlay()) {
    c.wantDecision = true;
    return 'deferred';
  }

  const state = useGameStore.getState();
  if (state.ownerUserId !== c.uid) return 'stale';
  const localPayload = cloudPayload(state);
  const local = describeLocal(state, localPayload);
  const server = describeServer(res);
  const verdict = decideSync({ local, server, seen: seenHashes(c.uid) });
  resetRetry(c);
  // One notice per decision, however many refusals it takes to land: the
  // player needs to hear once that there is another save, not once a race.
  if (!inner) c.told = false;
  const tell = (notice) => {
    if (c.told) return;
    c.told = true;
    toast({ queue: true, ...notice });
  };

  let outcome;
  if (verdict.action === 'in-sync') {
    commitMeta(c, server.rev, server.hash, server.payload, server.updatedAt);
    remember(c.uid, server.hash);
    setStatus({ phase: 'saved', savedAt: server.updatedAt ?? Date.now() });
    outcome = 'in-sync';
  } else if (verdict.action === 'push') {
    if (verdict.backup === 'server') {
      writeBackup(c.uid, server.payload);
      setStatus({ backup: backupSummary(c.uid) });
      tell({
        title: 'Two saves didn’t match',
        description: `Kept this device’s save (${summarise(localPayload)}). Your account’s other save is in Settings if you want it back.`,
      });
    }
    outcome = await push(c, { base: verdict.baseRev, conflicts, inner: true });
    if (c !== ctx) return 'stale';
  } else {
    if (verdict.backup === 'local') {
      writeBackup(c.uid, localPayload);
      setStatus({ backup: backupSummary(c.uid) });
    }
    adopt(c, server);
    setStatus({ phase: 'saved', savedAt: server.updatedAt ?? Date.now() });
    // After the status: a rollover is a change waiting to go ('pending').
    rollStoreForward();
    tell({
      ...(verdict.backup === 'local'
        ? {
          title: 'Two saves didn’t match',
          description: `Loaded your account’s save (${summarise(server.payload)}), which had more progress. This device’s is in Settings if you want it back.`,
        }
        : {
          title: 'Save loaded from your account',
          description: `${summarise(server.payload)}: picked up where you left off.`,
        }),
    });
    outcome = 'adopted';
  }
  if (!inner) settle(c, outcome);
  return outcome;
}

// What a timer, a return to the tab or a retry should do now.
const run = (c, trigger) => (c.wantDecision ? decide(c, trigger) : push(c));

/**
 * The keepalive send, for a tab that is hidden or a page that is going away.
 * Fire and forget: the answer, if the page is still there for it, is noted
 * like any other; a refusal waits for the next return to the tab to decide.
 */
function flush(reason) {
  const c = ctx;
  if (!c || !c.available || !c.token) return;
  clearTimeout(c.debounce);
  c.debounce = null;
  // Mid-battle, hold the send for the battle's result (battleInPlay): when
  // the tab is hidden, and at pagehide, whose listeners book that result
  // after this one. Not when the tab hides once the page is already going:
  // that comes after every pagehide listener, so whatever result there was to
  // book has been booked, and what is waiting goes now.
  const awaitingResult = reason === 'pagehide' || (reason === 'hide' && !c.unloading);
  if (awaitingResult && battleInPlay()) {
    c.wantPush = true;
    return;
  }
  // A send is out with this base already; a second could only be refused.
  // The first one's answer sends again if the save moved meanwhile. Except a
  // plain request while the page goes: unloading cancels it, and if it landed
  // after all, the compare-and-swap refuses this one, which is harmless.
  if ((c.pushing && !c.unloading) || c.flushing) return;
  const state = useGameStore.getState();
  if (state.ownerUserId !== c.uid) return;
  const payload = cloudPayload(state);
  const hash = saveHash(payload);
  if (hash === state.cloudSyncedHash || hash === c.flushedHash) return;
  if (byteSize(payload) > CLOUD_SAVE_MAX_BYTES) return;

  remember(c.uid, hash);
  c.flushedHash = hash;
  setStatus({ phase: 'saving' });
  c.flushing = putPlayerSaveKeepalive(payload, state.cloudRev, c.token)
    .then((raw) => {
      if (c !== ctx) return;
      const res = classifyRpc(raw, validPut);
      if (res.kind === 'ok' && res.ok) {
        commitMeta(c, res.rev, hash, payload, res.updatedAt);
        resetRetry(c);
        setStatus({ phase: 'saved', savedAt: res.updatedAt ?? Date.now() });
      } else if (res.kind === 'ok') {
        c.wantDecision = true;
        setStatus({ phase: 'pending' });
      } else if (res.kind === 'unavailable') {
        markUnavailable(c);
      } else if (res.kind === 'too-large') {
        markUnavailable(c, 'too-large');
      } else {
        c.wantPush = true;
        setStatus({ phase: 'offline' });
      }
    })
    .catch(() => {})
    .finally(() => {
      c.flushing = null;
      if (c !== ctx || !c.available) return;
      // The save moved while this was out, and the page is still here.
      if ((hidden() || c.unloading) && hasUnsyncedChanges(useGameStore.getState()) && !c.wantDecision) flush('changed');
    });
}

function onStoreChange(state, prev) {
  const c = ctx;
  if (!c || !c.available || applyingRemote) return;
  if (state.ownerUserId !== c.uid) return;
  if (!CLOUD_FIELDS.some((k) => state[k] !== prev[k])) return;
  // New references to the same save are not a change. Every return to the
  // tab re-reads the save from localStorage (useRehydrateOnFocus), and
  // persist's merge hands back fresh arrays, so the reference check alone
  // showed "Saving…" for three seconds over nothing, and sent nothing.
  if (saveHash(cloudPayload(state)) === saveHash(cloudPayload(prev))) return;
  // A change while hidden, or while the page goes, is sent at once: there
  // will be no three seconds. This is how an abandoned battle's loss, written
  // by GameBoard's pagehide listener after ours, still reaches the account.
  // At once, but after the code writing it has finished (a microtask): a
  // battle's result is several store writes in a row, and sent on the first,
  // the rest waited for an answer that a page going away never gets.
  if (hidden() || c.unloading) {
    if (!c.flushSoon) {
      c.flushSoon = true;
      queueMicrotask(() => {
        c.flushSoon = false;
        if (c === ctx) flush('changed');
      });
    }
    return;
  }
  clearTimeout(c.debounce);
  if (useCloudSave.getState().phase !== 'offline') setStatus({ phase: 'pending' });
  c.debounce = setTimeout(() => {
    c.debounce = null;
    enqueue(c, () => run(c, 'debounce'));
  }, PUSH_DEBOUNCE_MS);
}

function onVisibility() {
  const c = ctx;
  if (!c || !c.available) return;
  if (hidden()) {
    flush('hide');
    return;
  }
  // Back (a page restored from the back/forward cache comes back visible).
  c.unloading = false;
  c.flushedHash = null;
  const stale = Date.now() - c.lastCheck >= RECHECK_MIN_MS;
  if (c.wantDecision || stale) {
    enqueueDecision(c, 'visible');
  } else if (c.wantPush || hasUnsyncedChanges(useGameStore.getState())) {
    c.wantPush = false;
    enqueue(c, () => run(c, 'visible'));
  }
}

function onPageHide() {
  if (ctx) ctx.unloading = true;
  flush('pagehide');
}

// A page restored from the back/forward cache was never unloaded after all.
function onPageShow() {
  if (ctx) ctx.unloading = false;
}

function onOnline() {
  const c = ctx;
  if (!c || !c.available || !c.retry) return;
  clearTimeout(c.retry);
  c.retry = null;
  enqueue(c, () => run(c, 'online'));
}

/**
 * Start (or, for the same account, re-check) the cloud save. App calls this
 * from its session effect after bindSaveToUser, on every session change.
 * `onSettled(outcome)` runs after each decision (and, on a backend without
 * cloud saves, on every session change), which is when App reconciles gems.
 * Resolves with the first decision's outcome.
 */
export function startCloudSync({ userId, accessToken = null, onSettled = null }) {
  if (!userId) return Promise.resolve('signed-out');
  if (ctx && ctx.uid === userId) {
    ctx.token = accessToken ?? ctx.token;
    ctx.onSettled = onSettled ?? ctx.onSettled;
    if (!ctx.available) {
      // No cloud save to wait for, so the gems are reconciled on every
      // session change, exactly as they were before cloud saves: a purchase
      // made on another device lands without a reload. No decision can be
      // running to change the mark underneath it.
      const phase = useCloudSave.getState().phase;
      settle(ctx, phase);
      return Promise.resolve(phase);
    }
    // Session changes arrive on every return to the tab and every token
    // refresh; a re-read at most every RECHECK_MIN_MS is plenty.
    if (!ctx.wantDecision && Date.now() - ctx.lastCheck < RECHECK_MIN_MS) return Promise.resolve('recent');
    return enqueueDecision(ctx, 'session');
  }
  stopCloudSync();
  const c = {
    uid: userId,
    token: accessToken,
    onSettled,
    available: true,
    queue: Promise.resolve(),
    wantDecision: false,
    wantPush: false,
    debounce: null,
    retry: null,
    retryDelay: 0,
    lastCheck: 0,
    pushing: false,
    flushing: null,
    flushedHash: null,
    flushSoon: false,
    unloading: false,
    decisionQueued: null,
    told: false,
    detach: null,
  };
  ctx = c;
  const unsubscribe = useGameStore.subscribe(onStoreChange);
  // A return to the game re-reads the account, as useRehydrateOnFocus
  // re-reads the tabs: visibilitychange for a tab switch within a window,
  // focus for a switch between windows or back from another app, where the
  // tab never hides (a desktop window beside another one, a second monitor).
  // On visibilitychange alone, a laptop left beside the phone it was handed
  // to kept its stale save, and the player's next change met the phone's as
  // "Two saves didn't match". RECHECK_MIN_MS and enqueueDecision keep the
  // two events of one return to one read.
  document.addEventListener('visibilitychange', onVisibility);
  window.addEventListener('focus', onVisibility);
  window.addEventListener('pagehide', onPageHide);
  window.addEventListener('pageshow', onPageShow);
  window.addEventListener('online', onOnline);
  c.detach = () => {
    unsubscribe();
    document.removeEventListener('visibilitychange', onVisibility);
    window.removeEventListener('focus', onVisibility);
    window.removeEventListener('pagehide', onPageHide);
    window.removeEventListener('pageshow', onPageShow);
    window.removeEventListener('online', onOnline);
  };
  setStatus({ phase: 'checking', savedAt: useGameStore.getState().cloudSyncedAt, backup: backupSummary(userId) });
  c.firstDecision = enqueueDecision(c, 'login');
  return c.firstDecision;
}

/**
 * The sign-in's first decision for `uid`: resolves with its outcome once the
 * account's save has been taken, kept, or found out of reach. It resolves on
 * every outcome ('offline' and 'unavailable' included, and 'deferred' when
 * the tab was hidden), never rejects, and resolves at once for any account
 * this page is not syncing, so nothing waiting on it is held up by a backend
 * that cannot answer. App holds Daily Rewards and the first-run tutorial on
 * it: before it, a new device is still playing the wiped save bindToUser
 * left, and they opened on that.
 */
export function whenFirstDecision(uid) {
  return ctx && ctx.uid === uid && ctx.firstDecision ? ctx.firstDecision : Promise.resolve('none');
}

/** Stop syncing (sign-out). */
export function stopCloudSync() {
  if (ctx) {
    clearTimeout(ctx.debounce);
    clearTimeout(ctx.retry);
    ctx.detach?.();
    ctx = null;
  }
  setStatus({ phase: 'off', savedAt: null, backup: null });
}

/**
 * Send any change now and wait for it, up to `timeoutMs` (Sign Out does this
 * first, so the last few seconds of play reach the account). Resolves with
 * the outcome, or 'timeout'.
 */
export function saveNow({ timeoutMs = 4000 } = {}) {
  const c = ctx;
  if (!c || !c.available) return Promise.resolve('off');
  clearTimeout(c.debounce);
  c.debounce = null;
  let timer;
  const timeout = new Promise((resolve) => { timer = setTimeout(() => resolve('timeout'), timeoutMs); });
  return Promise.race([enqueue(c, () => run(c, 'save-now')), timeout]).finally(() => clearTimeout(timer));
}

/**
 * Switch to the backup save: the two swap places, so the save being replaced
 * becomes the backup and the player can switch back. The switched-to save
 * goes to the account as an ordinary change from the rev this device is in
 * step with. Returns false when there is no backup.
 */
export function switchToBackupSave() {
  const state = useGameStore.getState();
  const uid = ctx?.uid ?? state.ownerUserId;
  const backup = readBackup(uid);
  if (!uid || !backup) return false;
  writeBackup(uid, cloudPayload(state));
  quietly(() => useGameStore.setState({
    ...pick(normalizeSave(backup.save), CLOUD_FIELDS),
    pendingAchievements: [],
    pendingLevelUps: [],
    pendingSeasonDeliveries: [],
  }));
  newLineage(uid);
  rollStoreForward();
  setStatus({ backup: backupSummary(uid) });
  const c = ctx;
  if (c && c.uid === uid && c.available) {
    enqueue(c, () => run(c, 'switch'));
    // Its own gem mark came with it: reconcile against it.
    settle(c, 'switched');
  }
  return true;
}
