import { useGameStore, SAVE_FIELDS, normalizeSave } from '@/stores/gameStore';

/**
 * The part of the cloud save (src/lib/cloudSave.js) that has to run the moment
 * a session appears: binding the store to the account without losing the save
 * it replaces, and the fingerprint that says whether a save has changes its
 * account has not got. It is kept apart, and small, so that it can sit on the
 * boot path while the rest of the cloud save (the decision, the sending, the
 * status Settings shows) loads with the sign-in it serves.
 */

export const pick = (obj, keys) => Object.fromEntries(keys.map((k) => [k, obj[k]]));

export const isSaveObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

// ---------------------------------------------------------------------------
// What travels, and its fingerprint
// ---------------------------------------------------------------------------

// This device's own settings: a laptop's sound being off says nothing about
// the phone's. They neither go to the server nor come back from it.
export const DEVICE_FIELDS = ['soundEnabled', 'musicEnabled', 'animationsEnabled'];
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

// ---------------------------------------------------------------------------
// Device-local records
// ---------------------------------------------------------------------------

export const readJSON = (key) => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};
export const writeJSON = (key, value) => {
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
export const remember = (uid, hash) => {
  writeSeen(uid, [...seenHashes(uid)].filter((h) => h !== hash).concat(hash));
};
// A different save is in the store now: it grew from `from` (if anything).
export const newLineage = (uid, from = []) => writeSeen(uid, from);

// A save put aside when another account signs in on this device while it
// still had changes its account had not got (signed out offline, or on a
// backend without cloud saves). bindToUser wipes the store for the newcomer;
// before this, those changes were simply gone. It comes back, whole, the next
// time its own account signs in here.
const parkedKey = (uid) => `terrible-teddies-parked:${uid}`;

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
  // A controller still running belongs to the account being replaced, and
  // ignores a write to a save that is not its account's.
  useGameStore.setState({
    ...pick(restored, SAVE_FIELDS.filter((k) => !DEVICE_FIELDS.includes(k))),
    ownerUserId: uid,
  });
}
