import { create } from 'zustand';
import {
  useGameStore, SAVE_FIELDS, normalizeSave, getXPForLevel, keptThroughReset,
  STARTING_GEMS, BATTLE_XP,
} from '@/stores/gameStore';
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

// ---------------------------------------------------------------------------
// What travels, and its fingerprint
// ---------------------------------------------------------------------------

// This device's own settings: a laptop's sound being off says nothing about
// the phone's. They neither go to the server nor come back from it.
const DEVICE_FIELDS = ['soundEnabled', 'musicEnabled', 'animationsEnabled'];
// Which account, and the sync bookkeeping: about this copy, not the save.
const BOOKKEEPING = ['ownerUserId', 'cloudRev', 'cloudSyncedHash', 'cloudSyncedAt'];

/** The save fields that go to the account, in a fixed order. */
export const CLOUD_FIELDS = SAVE_FIELDS
  .filter((k) => !DEVICE_FIELDS.includes(k) && !BOOKKEEPING.includes(k))
  .sort();

/** The part of a save (the store's state, or a save from the server) that the account keeps. */
export const cloudPayload = (state) => {
  const out = {};
  for (const k of CLOUD_FIELDS) out[k] = state?.[k] === undefined ? null : state[k];
  return out;
};

// JSON with object keys sorted, so the same save always prints the same.
const stable = (v) => {
  if (Array.isArray(v)) return `[${v.map(stable).join(',')}]`;
  if (v && typeof v === 'object') {
    return `{${Object.keys(v).sort().map((k) => `${JSON.stringify(k)}:${stable(v[k])}`).join(',')}}`;
  }
  return JSON.stringify(v ?? null);
};

// cyrb53: a fast 53-bit string hash. Not for security: it only has to tell
// one save from another, so that "this save is the one last synced" costs a
// string compare rather than keeping a second copy of the save.
const cyrb53 = (str) => {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < str.length; i += 1) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507);
  h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507);
  h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
};

/** A save's fingerprint. Equal fingerprints, equal saves. */
export const saveHash = (payload) => {
  const text = stable(payload);
  return `${text.length.toString(36)}.${cyrb53(text)}`;
};

/** Whether the store holds changes the account has not got. */
export const hasUnsyncedChanges = (state) => saveHash(cloudPayload(state)) !== state.cloudSyncedHash;

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
 *     take the account's.
 *  5. This device's save was never synced and holds nothing (a new device,
 *     or a save just wiped for this account): take the account's.
 *  6. Both have changed: keep the one with more progress (this device's on a
 *     tie), and keep the other as a backup.
 *
 * `local`: { hash, syncedHash, rev, progress, fresh } — `fresh` is rule 5's
 * test (never synced and isFreshSave). `server`: { rev, hash, progress }, hash
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
  if (local.syncedHash !== null && local.hash === local.syncedHash) return { action: 'adopt', rule: 4 };
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

const isSaveObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

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
 *   unavailable — the function is not there (PostgREST's 404 / PGRST202), this
 *                 role may not call it, or it answered something else: this
 *                 backend has no cloud saves, and asking again will not help
 *   too-large   — the server's size cap (PT413, HTTP 413)
 *   error       — anything else (offline, a 5xx, an expired token): try again
 */
export const classifyRpc = (raw, validate) => {
  const { data, error, status } = raw || {};
  if (error) {
    const code = String(error.code || '');
    if (code === 'PT413' || status === 413) return { kind: 'too-large' };
    if (status === 404 || ['PGRST202', 'PGRST205', '42883', '42P01'].includes(code)) return { kind: 'unavailable' };
    if (code === '42501') return { kind: 'unavailable' };
    return { kind: 'error' };
  }
  const valid = validate(data);
  return valid ? { kind: 'ok', ...valid } : { kind: 'unavailable' };
};

// ---------------------------------------------------------------------------
// Device-local records: fingerprints seen, the backup, a parked save
// ---------------------------------------------------------------------------

const readJSON = (key) => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};
const writeJSON = (key, value) => {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage full or blocked: the records are a convenience on top of the
    // decision, which stays correct without them (it just backs up more).
  }
};

// Fingerprints of the saves this device's current save grew from, per
// account, newest last: the ones it sent, and the one it took. When a write
// is refused, the save the server holds is very often one this device sent
// itself (from another tab, or a keepalive whose answer never arrived), and
// then this device's save already contains it (rule 3), rather than being a
// second save to choose between.
//
// It is a claim about where the save in the store came from, so anything that
// puts a different save there starts it again: bindToUser's wipe, taking the
// account's save, switching to the backup. Without that, a device that had
// sent a save and was then wiped would find "its" save on the account and send
// the empty one over it.
//
// Kept outside the game save on purpose: every tab writes the game save in
// full, so a tab holding an old copy would write old bookkeeping back over it.
const SEEN_KEY = 'terrible-teddies-cloud-seen';
const SEEN_MAX = 12;

export const seenHashes = (uid) => {
  const all = readJSON(SEEN_KEY);
  return new Set(Array.isArray(all?.[uid]) ? all[uid] : []);
};
const writeSeen = (uid, list) => {
  const all = readJSON(SEEN_KEY) || {};
  all[uid] = list.slice(-SEEN_MAX);
  writeJSON(SEEN_KEY, all);
};
const remember = (uid, hash) => {
  writeSeen(uid, [...seenHashes(uid)].filter((h) => h !== hash).concat(hash));
};
// A different save is in the store now: it grew from `from` (if anything).
const newLineage = (uid, from = []) => writeSeen(uid, from);

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

// A save put aside when another account signs in on this device while it
// still had changes its account had not got (signed out offline, or on a
// backend without cloud saves). bindToUser wipes the store for the newcomer;
// before this, those changes were simply gone. It comes back, whole, the next
// time its own account signs in here.
const parkedKey = (uid) => `terrible-teddies-parked:${uid}`;

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
 * flush when the tab is hidden: if the page is going away, GameBoard's own
 * pagehide listener (registered after ours) books the abandoned battle as a
 * loss a moment later, and that write is sent by itself (see onStoreChange).
 * Sent first, the save without the loss would hold the rev, and the save
 * with it, carrying the same base, could only be refused.
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

// Note what the server holds now, on the store. In a hidden tab the store is
// re-read from localStorage first: a hidden tab's copy can be older than what
// the tab in front has written, and setState writes the whole save back.
const commitMeta = (c, rev, hash, at) => {
  if (hidden()) quietly(() => useGameStore.persist?.rehydrate?.());
  const s = useGameStore.getState();
  if (s.ownerUserId !== c.uid) return;
  quietly(() => useGameStore.setState({ cloudRev: rev, cloudSyncedHash: hash, cloudSyncedAt: at ?? Date.now() }));
};

const summarise = (save) => {
  const cards = new Set(Array.isArray(save?.ownedCards) ? save.ownedCards : []).size;
  return `Level ${Number(save?.level) || 1}, ${cards} cards`;
};

const pick = (obj, keys) => Object.fromEntries(keys.map((k) => [k, obj[k]]));

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
  newLineage(c.uid, [server.hash]);
};

const describeServer = (res) => {
  if (res.save === null) return { rev: res.rev, hash: null, progress: 0, payload: null, updatedAt: null };
  const payload = cloudPayload(normalizeSave(res.save));
  return { rev: res.rev, hash: saveHash(payload), progress: progressOf(payload), payload, updatedAt: res.updatedAt };
};

const describeLocal = (state, payload) => ({
  hash: saveHash(payload),
  syncedHash: state.cloudSyncedHash,
  rev: state.cloudRev,
  progress: progressOf(payload),
  fresh: state.cloudSyncedHash === null && isFreshSave(payload),
});

// Send the store's save from `base` (default: the rev it is in step with).
async function push(c, { base = null, conflicts = 0 } = {}) {
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
    commitMeta(c, res.rev, hash, res.updatedAt);
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
    return decide(c, 'conflict', conflicts + 1);
  }
  if (res.kind === 'unavailable') return markUnavailable(c);
  if (res.kind === 'too-large') return markUnavailable(c, 'too-large');
  return retryLater(c, 'push');
}

// Read the account's save and act on decideSync's verdict.
async function decide(c, trigger, conflicts = 0) {
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

  let outcome;
  if (verdict.action === 'in-sync') {
    commitMeta(c, server.rev, server.hash, server.updatedAt);
    remember(c.uid, server.hash);
    setStatus({ phase: 'saved', savedAt: server.updatedAt ?? Date.now() });
    outcome = 'in-sync';
  } else if (verdict.action === 'push') {
    if (verdict.backup === 'server') {
      writeBackup(c.uid, server.payload);
      setStatus({ backup: backupSummary(c.uid) });
      toast({
        queue: true,
        title: 'Two saves didn’t match',
        description: `Kept this device’s save (${summarise(localPayload)}). Your account’s other save is in Settings if you want it back.`,
      });
    }
    outcome = await push(c, { base: verdict.baseRev, conflicts });
    if (c !== ctx) return 'stale';
  } else {
    if (verdict.backup === 'local') {
      writeBackup(c.uid, localPayload);
      setStatus({ backup: backupSummary(c.uid) });
    }
    adopt(c, server);
    setStatus({ phase: 'saved', savedAt: server.updatedAt ?? Date.now() });
    toast({
      queue: true,
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
  settle(c, outcome);
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
  // Hidden mid-battle: hold the send for the battle's result (battleInPlay).
  if (reason === 'hide' && battleInPlay()) {
    c.wantPush = true;
    return;
  }
  // A send is out with this base already; a second could only be refused.
  // The first one's answer sends again if the save moved meanwhile.
  if (c.pushing || c.flushing) return;
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
        commitMeta(c, res.rev, hash, res.updatedAt);
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
      if (hidden() && hasUnsyncedChanges(useGameStore.getState()) && !c.wantDecision) flush('changed');
    });
}

function onStoreChange(state, prev) {
  const c = ctx;
  if (!c || !c.available || applyingRemote) return;
  if (state.ownerUserId !== c.uid) return;
  if (!CLOUD_FIELDS.some((k) => state[k] !== prev[k])) return;
  // A change while hidden is sent at once: the page may be going away. This
  // is how an abandoned battle's loss, written by GameBoard's pagehide
  // listener after the hide, still reaches the account.
  if (hidden()) {
    flush('changed');
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
  flush('hide');
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
 * `onSettled(outcome)` runs after each decision (and once when the backend
 * turns out to have no cloud saves), which is when App reconciles gems.
 * Resolves with the first decision's outcome.
 */
export function startCloudSync({ userId, accessToken = null, onSettled = null }) {
  if (!userId) return Promise.resolve('signed-out');
  if (ctx && ctx.uid === userId) {
    ctx.token = accessToken ?? ctx.token;
    ctx.onSettled = onSettled ?? ctx.onSettled;
    if (!ctx.available) return Promise.resolve(useCloudSave.getState().phase);
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
    decisionQueued: null,
    detach: null,
  };
  ctx = c;
  const unsubscribe = useGameStore.subscribe(onStoreChange);
  document.addEventListener('visibilitychange', onVisibility);
  window.addEventListener('pagehide', onPageHide);
  window.addEventListener('online', onOnline);
  c.detach = () => {
    unsubscribe();
    document.removeEventListener('visibilitychange', onVisibility);
    window.removeEventListener('pagehide', onPageHide);
    window.removeEventListener('online', onOnline);
  };
  setStatus({ phase: 'checking', savedAt: useGameStore.getState().cloudSyncedAt, backup: backupSummary(userId) });
  return enqueueDecision(c, 'login');
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
 * Bind the store to `uid` (gameStore's bindToUser), without losing the save
 * it replaces: a save that belongs to another account and has changes its
 * account has not got is parked first, and if `uid` has a parked save here
 * it comes back in place of the wiped one.
 */
export function bindSaveToUser(uid) {
  if (!uid) return;
  const state = useGameStore.getState();
  const owner = state.ownerUserId;
  if (owner && owner !== uid && hasUnsyncedChanges(state)) {
    writeJSON(parkedKey(owner), { savedAt: Date.now(), save: pick(state, SAVE_FIELDS) });
  }
  state.bindToUser(uid);
  if (!owner || owner === uid) return;
  newLineage(uid);
  const parked = readJSON(parkedKey(uid));
  writeJSON(parkedKey(uid), null);
  if (!isSaveObject(parked?.save)) return;
  const restored = normalizeSave(parked.save);
  quietly(() => useGameStore.setState({
    ...pick(restored, SAVE_FIELDS.filter((k) => !DEVICE_FIELDS.includes(k))),
    ownerUserId: uid,
  }));
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
  setStatus({ backup: backupSummary(uid) });
  const c = ctx;
  if (c && c.uid === uid && c.available) {
    enqueue(c, () => run(c, 'switch'));
    // Its own gem mark came with it: reconcile against it.
    settle(c, 'switched');
  }
  return true;
}
