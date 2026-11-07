import { DOOR_KEY } from './door.js';
import { playerFacingError } from './network.js';
import { browserLocalStorage, browserSessionStorage } from './safeStorage.js';

// What Settings says when an account export or deletion does not land.
// The SQL uses PT401 / PT429; a dead network uses the same sentence as the
// rest of the game ("Nothing was changed.").

export function accountActionMessage(error, fallback) {
  const code = error && typeof error === 'object' ? String(error.code || '') : '';
  const message = error && typeof error === 'object' && typeof error.message === 'string' ? error.message : '';
  if (code === 'PT429' || /slow down/i.test(message)) return 'Give it a minute, then try again.';
  if (code === 'PT401' || /not signed in/i.test(message)) return 'Sign in, then try again.';
  return playerFacingError(error, fallback);
}

export function isExportPayload(data) {
  return !!data && typeof data === 'object' && !Array.isArray(data) && typeof data.exported_at === 'string';
}

export const EXPORT_FILENAME = 'terrible-teddies-account.json';

/**
 * Wipe this device's copy of the account and leave the door's answer.
 * Payment screens and the game save live under these prefixes; the door
 * record is the device's, not the account's.
 */
export function clearLocalAccount(local = browserLocalStorage(), session = browserSessionStorage()) {
  let door = null;
  try {
    door = local.getItem(DOOR_KEY);
  } catch {
    door = null;
  }
  try { local.clear(); } catch { /* the wrapper does not throw; a stand-in might */ }
  if (door !== null) {
    try { local.setItem(DOOR_KEY, door); } catch { /* kept in memory by the wrapper when it can */ }
  }
  try { session.clear(); } catch { /* same */ }
}

export function exportJson(data) {
  return JSON.stringify(data, null, 2);
}
